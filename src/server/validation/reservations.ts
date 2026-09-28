import { z } from "zod";

export const slotIdSchema = z.string().uuid();
export const reservationIdSchema = z.string().uuid();

export const reservationCreateSchema = z.object({
  slotId: slotIdSchema,
});
