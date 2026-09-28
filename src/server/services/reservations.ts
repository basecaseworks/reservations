import { and, asc, eq, gte, sql } from "drizzle-orm";
import type { db } from "@/db/client";
import { reservations, rooms, slots } from "@/db/schema";

type Database = typeof db;

export class SlotNotFoundError extends Error {
  constructor() {
    super("Slot not found.");
    this.name = "SlotNotFoundError";
  }
}

export class SlotUnavailableError extends Error {
  constructor() {
    super("This slot is no longer available.");
    this.name = "SlotUnavailableError";
  }
}

export class ReservationConflictError extends Error {
  constructor() {
    super("This slot was just reserved by someone else.");
    this.name = "ReservationConflictError";
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  if ("code" in error && error.code === "23505") {
    return true;
  }

  return "cause" in error && isUniqueViolation(error.cause);
}

export function listRooms(database: Database) {
  return database.select().from(rooms).orderBy(asc(rooms.name));
}

export function listSlots(database: Database, from = new Date()) {
  return database
    .select({
      id: slots.id,
      roomId: rooms.id,
      roomName: rooms.name,
      startsAt: slots.startsAt,
      endsAt: slots.endsAt,
      isReserved: sql<boolean>`${reservations.id} is not null`,
    })
    .from(slots)
    .innerJoin(rooms, eq(slots.roomId, rooms.id))
    .leftJoin(reservations, eq(reservations.slotId, slots.id))
    .where(gte(slots.startsAt, from))
    .orderBy(asc(rooms.name), asc(slots.startsAt));
}

export function listUserReservations(database: Database, userId: string) {
  return database
    .select({
      id: reservations.id,
      slotId: slots.id,
      roomName: rooms.name,
      startsAt: slots.startsAt,
      endsAt: slots.endsAt,
      createdAt: reservations.createdAt,
    })
    .from(reservations)
    .innerJoin(slots, eq(reservations.slotId, slots.id))
    .innerJoin(rooms, eq(slots.roomId, rooms.id))
    .where(eq(reservations.userId, userId))
    .orderBy(asc(slots.startsAt), asc(reservations.id));
}

export async function createReservation(
  database: Database,
  userId: string,
  slotId: string,
) {
  const slot = await database
    .select({ id: slots.id, startsAt: slots.startsAt })
    .from(slots)
    .where(eq(slots.id, slotId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!slot) {
    throw new SlotNotFoundError();
  }

  if (slot.startsAt <= new Date()) {
    throw new SlotUnavailableError();
  }

  try {
    const created = await database
      .insert(reservations)
      .values({ slotId, userId })
      .returning({
        id: reservations.id,
        slotId: reservations.slotId,
        createdAt: reservations.createdAt,
      });

    return created[0];
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ReservationConflictError();
    }
    throw error;
  }
}

export function cancelReservation(database: Database, userId: string, reservationId: string) {
  return database
    .delete(reservations)
    .where(and(eq(reservations.id, reservationId), eq(reservations.userId, userId)))
    .returning({ id: reservations.id })
    .then((rows) => rows[0] ?? null);
}
