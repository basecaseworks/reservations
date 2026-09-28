import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { getAuthenticatedUser } from "@/server/auth";
import { cancelReservation } from "@/server/services/reservations";
import { reservationIdSchema } from "@/server/validation/reservations";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser(request.headers);
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { id } = await context.params;
    const parsedId = reservationIdSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json({ error: "Invalid reservation ID." }, { status: 400 });
    }

    const deleted = await cancelReservation(db, user.id, parsedId.data);
    if (!deleted) {
      return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Could not cancel reservation.", error);
    return NextResponse.json({ error: "Could not cancel reservation." }, { status: 500 });
  }
}
