import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db, sql } from "@/db/client";
import { account, reservations, rooms, session, slots, user } from "@/db/schema";
import { GET as getSlots } from "@/app/api/slots/route";
import { auth } from "@/server/auth";
import {
  cancelReservation,
  createReservation,
  listUserReservations,
  ReservationConflictError,
  SlotNotFoundError,
  SlotUnavailableError,
} from "@/server/services/reservations";

const databaseAvailable = Boolean(process.env.DATABASE_URL || process.env.TEST_DATABASE_URL);

describe.skipIf(!databaseAvailable)("reservations integration", () => {
  const timestamp = Date.now();
  const userA = {
    name: "Reservation User A",
    email: `reservations-a-${timestamp}@example.com`,
    password: "correct-horse-battery-staple",
  };
  const userB = {
    name: "Reservation User B",
    email: `reservations-b-${timestamp}@example.com`,
    password: "correct-horse-battery-staple",
  };
  let userAId = "";
  let userBId = "";
  let testRoomId = "";
  let testSlotId = "";

  beforeAll(async () => {
    const signupA = await auth.api.signUpEmail({ body: userA });
    const signupB = await auth.api.signUpEmail({ body: userB });
    userAId = signupA.user.id;
    userBId = signupB.user.id;

    const room = await db
      .insert(rooms)
      .values({ name: `Integration Room ${timestamp}` })
      .returning({ id: rooms.id });
    testRoomId = room[0].id;

    const startsAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    const slot = await db
      .insert(slots)
      .values({ roomId: testRoomId, startsAt, endsAt })
      .returning({ id: slots.id });
    testSlotId = slot[0].id;
  });

  beforeEach(async () => {
    await db
      .delete(reservations)
      .where(inArray(reservations.userId, [userAId, userBId]));
  });

  it("requires authentication for protected slot endpoints", async () => {
    const response = await getSlots(new Request("http://localhost/api/slots"));
    expect(response.status).toBe(401);
  });

  it("registers and logs in with email and password", async () => {
    const result = await auth.api.signInEmail({
      body: { email: userA.email, password: userA.password },
    });

    expect(result.user.id).toBe(userAId);
    expect(result.token).toBeTruthy();
  });

  it("reserves an available slot and lists it for the owner", async () => {
    const reservation = await createReservation(db, userAId, testSlotId);
    const userReservations = await listUserReservations(db, userAId);

    expect(reservation.slotId).toBe(testSlotId);
    expect(userReservations).toHaveLength(1);
    expect(userReservations[0]?.id).toBe(reservation.id);
  });

  it("allows only the owner to cancel a reservation", async () => {
    const reservation = await createReservation(db, userAId, testSlotId);

    expect(await cancelReservation(db, userBId, reservation.id)).toBeNull();
    expect(await listUserReservations(db, userAId)).toHaveLength(1);
    expect(await cancelReservation(db, userAId, reservation.id)).toEqual({ id: reservation.id });
    expect(await listUserReservations(db, userAId)).toHaveLength(0);
  });

  it("rejects a nonexistent slot", async () => {
    await expect(
      createReservation(db, userAId, "123e4567-e89b-42d3-a456-426614174000"),
    ).rejects.toBeInstanceOf(SlotNotFoundError);
  });

  it("rejects a second submission by the same user and rejects past slots", async () => {
    await createReservation(db, userAId, testSlotId);
    await expect(createReservation(db, userAId, testSlotId)).rejects.toBeInstanceOf(ReservationConflictError);

    const pastSlot = await db
      .insert(slots)
      .values({
        roomId: testRoomId,
        startsAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() - 60 * 60 * 1000),
      })
      .returning({ id: slots.id });

    await expect(createReservation(db, userBId, pastSlot[0].id)).rejects.toBeInstanceOf(SlotUnavailableError);
    await db.delete(slots).where(eq(slots.id, pastSlot[0].id));
  });

  it("enforces the slot time-order check in PostgreSQL", async () => {
    await expect(
      db.insert(slots).values({
        roomId: testRoomId,
        startsAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
      }),
    ).rejects.toThrow();
  });

  it("allows only one concurrent reservation for a slot", async () => {
    const results = await Promise.allSettled([
      createReservation(db, userAId, testSlotId),
      createReservation(db, userBId, testSlotId),
    ]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    const stored = await db.select().from(reservations).where(eq(reservations.slotId, testSlotId));

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ReservationConflictError);
    expect(stored).toHaveLength(1);
  });

  afterAll(async () => {
    await db.delete(reservations).where(inArray(reservations.userId, [userAId, userBId]));
    await db.delete(slots).where(and(eq(slots.id, testSlotId), eq(slots.roomId, testRoomId)));
    await db.delete(rooms).where(eq(rooms.id, testRoomId));
    await db.delete(session).where(inArray(session.userId, [userAId, userBId]));
    await db.delete(account).where(inArray(account.userId, [userAId, userBId]));
    await db.delete(user).where(inArray(user.id, [userAId, userBId]));
    await sql.end();
  });
});
