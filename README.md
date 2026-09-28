# Reservations

Minimal working room reservation system with email/password authentication and exclusive time slots.

## Features

- Register, log in, and log out.
- View rooms and upcoming time slots.
- Reserve an unreserved slot.
- View and cancel your own reservations.
- Prevent double booking with a PostgreSQL unique index.

## Stack

- Next.js and React
- TypeScript and plain CSS
- Better Auth for email/password authentication
- Drizzle ORM with PostgreSQL
- Zod for server-side validation
- Vercel-compatible Next.js API routes

## Run locally

Requirements: Node.js 20.9 or newer and PostgreSQL 14 or newer.

```bash
git clone https://github.com/basecaseworks/reservations.git
cd reservations
npm install
cp .env.example .env.local
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Copy `.env.example` to `.env.local` and set:

- `DATABASE_URL`: PostgreSQL connection string.
- `BETTER_AUTH_SECRET`: high-entropy secret of at least 32 characters.
- `BETTER_AUTH_URL`: application base URL, such as `http://localhost:3000`.

Never commit `.env.local` or real secrets.

## Database

The schema contains:

- `rooms`: required unique room names.
- `slots`: a room, `starts_at`, `ends_at`, and a check constraint requiring `ends_at > starts_at`.
- `reservations`: a slot, a Better Auth user, and a unique index on `slot_id`.

Slots also have a unique `(room_id, starts_at, ends_at)` index to prevent duplicate logical slots. The unique reservation index is the final protection against concurrent double booking: two requests may check the same slot at the same time, but PostgreSQL allows only one insert to succeed.

Apply committed migrations to a new database with:

```bash
npm run db:migrate
```

Seed two meeting rooms and five days of hourly slots with:

```bash
npm run db:seed
```

The seed is safe to rerun: room names and logical room/time slots use database uniqueness constraints to avoid duplicates. Seeded timestamps are created from the local runtime timezone and displayed using the browser's locale.

The application uses ordinary PostgreSQL connections, so changing from Neon to another PostgreSQL provider only requires changing `DATABASE_URL`.

## API

Better Auth is mounted at `/api/auth/[...all]`.

```text
GET    /api/rooms
GET    /api/slots
POST   /api/reservations
GET    /api/reservations
DELETE /api/reservations/:id
```

`/api/slots` and `/api/reservations` require an authenticated session. Create reservations with `{ "slotId": "..." }`. A nonexistent slot returns `404`, an invalid request returns `400`, and a past or already reserved slot returns `409`.

Cancellation always includes the authenticated user's ID in the database delete condition, so changing a reservation ID cannot cancel another user's reservation.

## Tests

Run the complete local verification with:

```bash
npm run verify
```

The integration suite runs when `DATABASE_URL` or `TEST_DATABASE_URL` is set and the migrated database is available. It covers registration/login, protected endpoints, reservation ownership, cancellation, nonexistent slots, and concurrent booking of the same slot. `npm run verify` runs linting, type checking, tests, and a production build.

## Deployment

Deploy the repository as a Next.js project on Vercel. Set `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL` in the Vercel project environment, run the committed migrations against the production PostgreSQL database, seed the initial rooms and slots if needed, and deploy.

Neon is a suitable hosted PostgreSQL option, but no Neon-specific application code is required.

## Intentionally not included

Payments, maps, notifications, calendar integrations, recurring bookings, multi-day reservations, waitlists, approvals, reminders, roles, and resource administration are outside this reference implementation.
