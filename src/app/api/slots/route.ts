import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { getAuthenticatedUser } from "@/server/auth";
import { listSlots } from "@/server/services/reservations";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request.headers);
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const slotRows = await listSlots(db);
    return NextResponse.json({ slots: slotRows });
  } catch (error) {
    console.error("Could not load slots.", error);
    return NextResponse.json({ error: "Could not load slots." }, { status: 500 });
  }
}
