import "dotenv/config";
import { inArray } from "drizzle-orm";
import { db, sql } from "@/db/client";
import { rooms, slots } from "@/db/schema";

const roomNames = ["Meeting Room A", "Meeting Room B"];

async function seed() {
  await db
    .insert(rooms)
    .values(roomNames.map((name) => ({ name })))
    .onConflictDoNothing();

  const roomRows = await db.select().from(rooms).where(inArray(rooms.name, roomNames));
  const firstSlotDay = new Date();
  firstSlotDay.setDate(firstSlotDay.getDate() + 1);
  firstSlotDay.setHours(9, 0, 0, 0);

  const slotValues = roomRows
    .flatMap((room) =>
      Array.from({ length: 5 }, (_, dayIndex) =>
        Array.from({ length: 8 }, (_, slotIndex) => {
          const startsAt = new Date(firstSlotDay);
          startsAt.setDate(startsAt.getDate() + dayIndex);
          startsAt.setHours(9 + slotIndex, 0, 0, 0);

          const endsAt = new Date(startsAt);
          endsAt.setHours(endsAt.getHours() + 1);

          return { roomId: room.id, startsAt, endsAt };
        }),
      ),
    )
    .flat();

  await db.insert(slots).values(slotValues).onConflictDoNothing();
  console.log(`Seeded ${roomRows.length} rooms and ${slotValues.length} upcoming slots.`);
  await sql.end();
}

seed().catch(async (error) => {
  console.error("Could not seed the database.", error);
  await sql.end({ timeout: 1 }).catch(() => undefined);
  process.exitCode = 1;
});
