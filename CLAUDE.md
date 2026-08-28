@AGENTS.md

# Sports Booking App — Project Memory

Read `MVP_TASK_BREAKDOWN.md` in this same repo for the full numbered ticket list, time estimates, and dependency order. This file covers everything else: project context, decisions made, current state, and hard-won gotchas.

## Project overview

A sports/activity booking platform for discovering and booking tennis courts, padel courts, campsites, and fitness classes. Full-stack Next.js/TypeScript application, developed under an accelerated, scope-disciplined timeline — every scope decision in this project prioritizes the simpler, shippable option over the more "complete" one unless explicitly noted otherwise.

## Tech stack

Next.js (App Router, latest) + TypeScript. Tailwind CSS + Shadcn UI (Shadcn is built on Radix primitives + Tailwind styling — not a competing library). PostgreSQL on Supabase. Prisma ORM (v7 — see gotchas section, this version introduced major breaking changes vs. what most tutorials/training data will assume). Auth.js (NextAuth) — self-implemented rather than a third-party auth SaaS (e.g. Clerk), to keep full control over the auth flow and avoid an external vendor dependency. Stripe (test mode only). Deployed on Vercel, connected via Vercel's Supabase Marketplace integration (env vars auto-synced, not manually managed).

Package manager is **pnpm**, not npm — this matters, pnpm has different install/build-script behavior (see gotchas).

## Data model (current, as of Phase 3 completion)

Five core tables, deliberately kept simple:

- **User** — role enum (`admin` / `venue_owner` / `user`). A venue_owner can own multiple venues from one account (Venue.ownerId is just a foreign key on Venue, not a special account type). Multi-manager-per-venue (many-to-many staff) was considered and explicitly deferred — not built.
- **Venue** — belongs to one owner (User). Has city/address as plain text — no lat/long coordinates exist yet; real distance-based search is explicitly future work, not MVP.
- **Activity** — a platform-wide category (Tennis, Padel, Camping, Gym Class, Tennis Class, etc.) — NOT scoped to a venue. Admin-managed conceptually (no admin UI built; managed via the seed script only, by design, for MVP). Has a `bookingMechanic` enum: `time_range` (pick a start time + duration — courts), `date_range` (pick start/end date — camping), or `fixed_session` (book into one scheduled occurrence — classes).
- **Resource** — the actual bookable thing at a specific venue ("Court 1," "Campsite A," "Monday 6pm HIIT"). Belongs to one Venue + one Activity. Has a `capacity` field (1 for exclusive-use courts, >1 for classes) plus availability-rule fields that differ depending on its Activity's bookingMechanic (operating hours/duration/increment for time_range; min/max days for date_range; recurrence day/time/duration for fixed_session).
- **Booking** — belongs to one Resource, optionally one User (null = guest booking, with guestName/guestEmail/guestPhone fields used instead). Always stores its own `startsAt`/`endsAt` directly.
- **Tag** + **ActivityTag** (join table) — many-to-many quick-filter tags for the browse UI (e.g. "Tennis," "Classes," "Fitness"). An Activity can carry multiple tags — "Tennis Class" is tagged both "Tennis" and "Classes" — which is why this needed a join table rather than a simple field.

**There is deliberately no "Slot" table anywhere in this schema.** Early design considered pre-generating discrete bookable time-slot rows, but this doesn't scale once booking duration is variable (30min–2hr, venue-configurable). Instead: `Booking.startsAt`/`endsAt` are always stored directly against the Resource, and conflict prevention is an **application-level check inside a transaction** — count existing active (non-cancelled) bookings on that Resource whose time range overlaps the requested range, reject if that count is already `>= Resource.capacity`. This single rule covers exclusive-use courts (capacity 1, any overlap blocks) and multi-spot classes (capacity 20, allows up to 20 overlapping/identical-time bookings) with no branching logic. **This overlap-vs-capacity check is not yet implemented — it belongs to ticket 5.4 and hasn't been built yet.**

Naming convention: Prisma model/field names are camelCase (idiomatic TS), mapped to snake_case actual Postgres tables/columns via `@map`/`@@map`.

## Auth model

Three roles: `admin` (full access), `venue_owner` (manage only venues where `Venue.ownerId` matches their own user id — not exclusive, can also browse/book like a normal user elsewhere), `user` (browse/book/manage own bookings). Guest checkout supported (no account, contact info stored directly on Booking). **Auth.js is not yet implemented — that's Phase 2, not started.**

## MVP scope — explicitly cut, do not build unless asked

Reviews/ratings, real-time notifications, venue-owner/multi-role staff accounts, geolocation-based search (no coordinates exist), real Stripe payouts (test mode only), a full admin UI for managing venues/activities (seed script only).

## Current status (update this section as work progresses)

Phase 0 (setup) — done: Next.js, Tailwind, Shadcn, Prisma+Supabase all connected and verified, git repo with `main`/`dev` branches, deployed to Vercel (production on `main`, preview deployments on `dev`).

Phase 1 (data model) — done: schema written and migrated. Ticket 1.3 (original "unique constraint on Slot" wording) is superseded/obsolete — see data model section above; that work is now ticket 5.4.

Phase 3 (seed data) — done: `prisma/seed.ts` seeds 6 tags, 7 activities, 3 users (2 venue owners — one, Alex, deliberately owns 2 venues to prove the multi-venue-per-owner model — plus 1 regular user), 4 venues, 10 resources spanning all three booking mechanics.

Phase 2 (Authentication) — **Starting now.**

**Phase 4 (Browse & Discovery) — TO BE STARTED AFTER PHASE 2 IS COMPLETE.** Covers: shared layout, browse/listing page (server component), filter UI (see filter design below), resource card component, resource detail page, empty/loading states.

**Filter design agreed for Phase 4** (not yet built): two-dimensional browse UX inspired by UberEats. Top row = quick-filter Tag buttons (Tennis, Padel, Classes, Camping, Fitness, Football), backed by the Tag/ActivityTag many-to-many relationship — clicking one shows all Resources whose Activity carries that tag. Sidebar = three filters, all free (existing fields, no schema changes needed): City (`Venue.city`), Price range (`Resource.pricePerUnit`), Booking type (`Activity.bookingMechanic`, relabeled for users as "Book a Time," "Multi-Day," "Classes"). Free-text search should do partial/substring matching (not exact match) across Activity/Resource/Venue name, so e.g. searching "Tennis" surfaces both plain Tennis courts and Tennis Class sessions — results need a visible label per card so the two are distinguishable at a glance.

## Prisma 7 gotchas (important — Claude Code's training data may predate these and give outdated advice)

This project hit several real breaking changes going from "how Prisma tutorials generally describe it" to actual Prisma 7 behavior. Do not follow older Prisma patterns without checking current docs first:

- `schema.prisma`'s `datasource` block no longer takes `url` or `directUrl` at all (both removed in v7). Connection URLs live exclusively in `prisma.config.ts`, under `datasource: { url: env(...) }`. `directUrl` has no v7 replacement in `prisma.config.ts` either — only one URL for the CLI, and it should be the direct/non-pooled one (migrations need session-level features pooling doesn't support).
- The `generator client` block requires an explicit `output` path (no default location anymore), and uses `provider = "prisma-client"` (not the older `"prisma-client-js"`).
- The running app's `PrismaClient` must be constructed with an explicit driver `adapter` (this project uses `@prisma/adapter-pg` + `pg`, wrapping a connection pool) — see `lib/prisma.ts`.
- **Seeding is no longer automatic.** `prisma migrate dev` / `prisma migrate reset` do NOT run the seed script anymore, even with `migrations.seed` correctly configured in `prisma.config.ts`. You must explicitly run `prisma db seed` as a separate command after migrating.
- Connecting to Supabase via `pg`/`@prisma/adapter-pg` throws `self-signed certificate in certificate chain` by default — fix is appending `&uselibpqcompat=true` to the pooled connection string (`POSTGRES_PRISMA_URL`).
- Vercel's Supabase integration provides `POSTGRES_PRISMA_URL` (pooled, port 6543, use for the app's runtime `PrismaClient`) and `POSTGRES_URL_NON_POOLING` (direct, port 5432, use for `prisma.config.ts`'s CLI connection / migrations). Don't confuse the two.
- Deploying to Vercel requires a `"postinstall": "prisma generate"` script in `package.json` — the `generated/prisma` client output folder is (correctly) gitignored, so nothing generates it automatically on a fresh Vercel checkout otherwise.
- pnpm specifically (not npm) blocks Prisma's install scripts by default (`ERR_PNPM_IGNORED_BUILDS`) — fix with `pnpm approve-builds prisma @prisma/engines` then `pnpm install`.
- A Prisma 8 release candidate exists but is pre-release — deliberately staying on 7.9.1 for the rest of this build.

## Conventions

Ticket IDs follow `phase.subtask` (e.g. `5.4`) and are used as human-readable references in commit messages and on the GitHub Projects board. **Important:** GitHub Issues for this project were created manually, one by one, directly on GitHub — the `create_github_tickets.sh` bulk-creation script was written but never actually run, because it got fiddly to work with. This means GitHub's own auto-assigned issue numbers do **not** match the phase.subtask ticket numbering. If a commit needs to actually link to a GitHub issue (e.g. `closes #N`), `N` must be looked up as that ticket's real GitHub issue number — never assume it equals the phase.subtask number (e.g. ticket `5.3` might actually be GitHub issue `#17`). The phase.subtask number should **not** appear in the commit message text, only the task name, GitHub's #N number to be entered manually on commit. Work happens on a `dev` branch; `main` is production and auto-deploys via Vercel on merge.

## Coding standards

All code written for this project — by Claude or otherwise — must be commented to a professional, production standard: explain intent and non-obvious reasoning (why a decision was made, what edge case is being handled, why one approach was chosen over another), not restate what the code already visibly does. Write comments assuming a new developer with zero prior context on this project needs to read them and pick up the work. Avoid comment noise (e.g. `// create a user` above a line that obviously creates a user) — every comment should earn its place. This is the standard already set in `prisma/seed.ts` and should be matched in every file going forward, to keep the codebase maintainable and easy for any engineer joining the project to pick up.
