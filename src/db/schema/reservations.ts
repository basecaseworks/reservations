import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const rooms = pgTable("rooms", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const slots = pgTable(
  "slots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("slots_time_order_check", sql`${table.endsAt} > ${table.startsAt}`),
    uniqueIndex("slots_room_time_unique").on(table.roomId, table.startsAt, table.endsAt),
    index("slots_room_starts_at_idx").on(table.roomId, table.startsAt),
  ],
);

export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slotId: uuid("slot_id")
      .notNull()
      .references(() => slots.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("reservations_slot_id_unique").on(table.slotId),
    index("reservations_user_created_at_idx").on(table.userId, table.createdAt),
  ],
);

export const roomsRelations = relations(rooms, ({ many }) => ({
  slots: many(slots),
}));

export const slotsRelations = relations(slots, ({ many, one }) => ({
  room: one(rooms, {
    fields: [slots.roomId],
    references: [rooms.id],
  }),
  reservations: many(reservations),
}));

export const reservationsRelations = relations(reservations, ({ one }) => ({
  slot: one(slots, {
    fields: [reservations.slotId],
    references: [slots.id],
  }),
  user: one(user, {
    fields: [reservations.userId],
    references: [user.id],
  }),
}));
