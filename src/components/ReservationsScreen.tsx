"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type Slot = {
  id: string;
  roomId: string;
  roomName: string;
  startsAt: string;
  endsAt: string;
  isReserved: boolean;
};

type UserReservation = {
  id: string;
  slotId: string;
  roomName: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
};

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatRange(startsAt: string, endsAt: string) {
  return `${dateTimeFormatter.format(new Date(startsAt))} – ${dateTimeFormatter.format(new Date(endsAt))}`;
}

async function readResponse(response: Response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error ?? "Could not complete the request.");
    Object.assign(error, { status: response.status });
    throw error;
  }
  return payload;
}

export function ReservationsScreen() {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [myReservations, setMyReservations] = useState<UserReservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [conflictSlotId, setConflictSlotId] = useState<string | null>(null);
  const [busySlotId, setBusySlotId] = useState<string | null>(null);
  const [busyReservationId, setBusyReservationId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [slotsResponse, reservationsResponse] = await Promise.all([
        fetch("/api/slots", { cache: "no-store" }),
        fetch("/api/reservations", { cache: "no-store" }),
      ]);

      if (slotsResponse.status === 401 || reservationsResponse.status === 401) {
        router.replace("/login");
        return;
      }

      const [slotPayload, reservationPayload] = await Promise.all([
        readResponse(slotsResponse),
        readResponse(reservationsResponse),
      ]);
      setSlots(slotPayload.slots);
      setMyReservations(reservationPayload.reservations);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load reservations.");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // The first request synchronizes the screen with the authenticated server state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const slotsByRoom = useMemo(() => {
    return slots.reduce<Record<string, Slot[]>>((groups, slot) => {
      groups[slot.roomName] ??= [];
      groups[slot.roomName].push(slot);
      return groups;
    }, {});
  }, [slots]);

  async function reserve(slotId: string) {
    setBusySlotId(slotId);
    setConflictSlotId(null);
    setActionError(null);

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId }),
      });

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (response.status === 409) {
        const payload = await response.json().catch(() => null);
        setConflictSlotId(slotId);
        setActionError(payload?.error ?? "This slot was just reserved by someone else.");
        await loadData();
        return;
      }

      await readResponse(response);
      await loadData();
    } catch (reservationError) {
      setActionError(
        reservationError instanceof Error ? reservationError.message : "Could not reserve slot.",
      );
    } finally {
      setBusySlotId(null);
    }
  }

  async function cancel(reservationId: string) {
    setBusyReservationId(reservationId);
    setActionError(null);

    try {
      const response = await fetch(`/api/reservations/${reservationId}`, { method: "DELETE" });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      await readResponse(response);
      await loadData();
    } catch (cancelError) {
      setActionError(cancelError instanceof Error ? cancelError.message : "Could not cancel reservation.");
    } finally {
      setBusyReservationId(null);
    }
  }

  async function logOut() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <main>
      <header className="page-header">
        <h1>Reservations</h1>
        <button className="button secondary" type="button" onClick={logOut}>Log out</button>
      </header>

      {actionError ? (
        <p className="error-message status-line" role="alert">{actionError}</p>
      ) : null}

      {isLoading ? (
        <div className="loading-state"><p>Loading...</p></div>
      ) : error ? (
        <div className="empty-state">
          <p className="error-message" role="alert">{error}</p>
          <button className="button secondary" type="button" onClick={() => void loadData()}>Try again</button>
        </div>
      ) : (
        <>
          <section className="section" aria-labelledby="available-heading">
            <h2 id="available-heading">Available slots</h2>
            {Object.keys(slotsByRoom).length === 0 ? (
              <div className="empty-state"><p>No available slots.</p></div>
            ) : (
              Object.entries(slotsByRoom).map(([roomName, roomSlots]) => (
                <section className="room-section" key={roomName} aria-labelledby={`room-${roomSlots[0]?.roomId}`}>
                  <h3 id={`room-${roomSlots[0]?.roomId}`}>{roomName}</h3>
                  <div className="slot-list">
                    {roomSlots.map((slot) => (
                      <div className="slot-row" key={slot.id}>
                        <div className="slot-main">
                          <span className="slot-time">{formatRange(slot.startsAt, slot.endsAt)}</span>
                          {conflictSlotId === slot.id ? (
                            <p className="conflict-message" role="alert">{actionError}</p>
                          ) : null}
                        </div>
                        <div className="slot-action">
                          {slot.isReserved ? (
                            <span className="reserved-label">Reserved</span>
                          ) : (
                            <button className="button" type="button" onClick={() => void reserve(slot.id)} disabled={busySlotId !== null}>
                              {busySlotId === slot.id ? "Reserving..." : "Reserve"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))
            )}
          </section>

          <section className="section" aria-labelledby="mine-heading">
            <h2 id="mine-heading">My reservations</h2>
            {myReservations.length === 0 ? (
              <div className="empty-state"><p>No reservations yet.</p></div>
            ) : (
              <div className="reservation-list">
                {myReservations.map((reservation) => (
                  <div className="reservation-row" key={reservation.id}>
                    <div className="reservation-main">
                      <strong>{reservation.roomName}</strong>
                      <span className="slot-time">{formatRange(reservation.startsAt, reservation.endsAt)}</span>
                    </div>
                    <div className="reservation-action">
                      <button className="button danger" type="button" onClick={() => void cancel(reservation.id)} disabled={busyReservationId !== null}>
                        {busyReservationId === reservation.id ? "Cancelling..." : "Cancel"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
