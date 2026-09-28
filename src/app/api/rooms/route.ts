import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { listRooms } from "@/server/services/reservations";

export const runtime = "nodejs";

export async function GET() {
  try {
    const roomRows = await listRooms(db);
    return NextResponse.json({ rooms: roomRows });
  } catch (error) {
    console.error("Could not load rooms.", error);
    return NextResponse.json({ error: "Could not load rooms." }, { status: 500 });
  }
}
