import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { getAuthenticatedUser } from "@/server/auth";
import {
  createReservation,
  listUserReservations,
  ReservationConflictError,
  SlotNotFoundError,
  SlotUnavailableError,
} from "@/server/services/reservations";
import { reservationCreateSchema } from "@/server/validation/reservations";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request.headers);
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const reservationRows = await listUserReservations(db, user.id);
    return NextResponse.json({ reservations: reservationRows });
  } catch (error) {
    console.error("Could not load reservations.", error);
    return NextResponse.json({ error: "Could not load reservations." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request.headers);
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = reservationCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid reservation." },
        { status: 400 },
      );
    }

    const reservation = await createReservation(db, user.id, parsed.data.slotId);
    return NextResponse.json({ reservation }, { status: 201 });
  } catch (error) {
    if (error instanceof SlotNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof SlotUnavailableError || error instanceof ReservationConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error("Could not create reservation.", error);
    return NextResponse.json({ error: "Could not create reservation." }, { status: 500 });
  }
}
