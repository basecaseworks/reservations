import { describe, expect, it } from "vitest";
import { reservationCreateSchema, reservationIdSchema, slotIdSchema } from "@/server/validation/reservations";

describe("reservation validation", () => {
  it("accepts a valid slot id", () => {
    expect(
      reservationCreateSchema.safeParse({ slotId: "123e4567-e89b-42d3-a456-426614174000" }).success,
    ).toBe(true);
  });

  it("rejects malformed slot and reservation ids", () => {
    expect(slotIdSchema.safeParse("not-a-uuid").success).toBe(false);
    expect(reservationIdSchema.safeParse("not-a-uuid").success).toBe(false);
    expect(reservationCreateSchema.safeParse({}).success).toBe(false);
  });
});
