@AGENTS.md

# Sports Booking App — Project Memory

Read `MVP_TASK_BREAKDOWN.md` in this same repo for the full numbered ticket list, time estimates, and dependency order. This file covers everything else: project context, decisions made, current state, and hard-won gotchas.

## Project overview

A sports/activity booking platform for discovering and booking tennis courts, padel courts, campsites, and fitness classes. Full-stack Next.js/TypeScript application, developed under an accelerated, scope-disciplined timeline — every scope decision in this project prioritizes the simpler, shippable option over the more "complete" one unless explicitly noted otherwise.

## Tech stack

Next.js (App Router, latest) + TypeScript. Tailwind CSS + Shadcn UI (Shadcn is built on Radix/Base UI primitives + Tailwind styling — not a competing library; this project's shadcn install uses the `base-vega` style on `@base-ui/react`, not classic Radix). PostgreSQL on Supabase. Prisma ORM (v7 — see gotchas section, this version introduced major breaking changes vs. what most tutorials/training data will assume). Auth.js (NextAuth) — self-implemented rather than a third-party auth SaaS (e.g. Clerk), to keep full control over the auth flow and avoid an external vendor dependency. Stripe (test mode only, not yet integrated). Deployed on Vercel, connected via Vercel's Supabase Marketplace integration (env vars auto-synced, not manually managed).

Package manager is **pnpm**, not npm — this matters, pnpm has different install/build-script behavior (see gotchas).

## Data model (current)

- **User** — role enum (`admin` / `venue_owner` / `user`). A venue_owner can own multiple venues from one account (`Venue.ownerId` is just a foreign key on Venue, not a special account type). Multi-manager-per-venue (many-to-many staff) was considered and explicitly deferred — not built.
- **City** — platform-curated reference data, same pattern as Tag/Activity (venue managers pick from this list rather than typing a city name freely). Has `name`, `region`, `timezone`. `Venue.cityId` is a foreign key into this, not a free-text string.
- **Venue** — belongs to one owner (User) and one City. Has `address` as plain text (no lat/long — real distance-based search is explicitly future work). `bookingWindowDays` (default 30) is the rolling public booking window; `holdDurationMinutes` (default 10) is the default cart-lock duration, inherited by its Listings unless overridden.
- **Activity** — a platform-wide category (Tennis, Padel, Camping, Gym Class, Tennis Class, etc.) — NOT scoped to a venue. Admin-managed conceptually (no admin UI built; managed via the seed script only, by design, for MVP). Has a `bookingMechanic` enum: `time_range` (pick a start time + duration — courts), `date_range` (pick start/end date — camping), or `fixed_session` (book into one scheduled occurrence — classes).
- **Listing** (renamed from the original "Resource") — the actual bookable thing at a specific venue ("Court 1," "Campsite A," "Monday 6pm HIIT"). Belongs to one Venue + one Activity. `capacity` is nullable (`null` = unlimited, e.g. a free group run). Has availability-rule fields that differ by its Activity's `bookingMechanic` (operating hours/duration/increment for `time_range`; min/max days for `date_range`; recurrence day/time/duration for `fixed_session`). `archivedAt` (nullable) retires a listing from browse/booking without deleting it — deleting would cascade and destroy booking history, which `Booking.listing`'s `onDelete: Restrict` explicitly prevents; archiving is the only supported way to retire a listing with any booking history.
- **Booking** — belongs to one Listing, optionally one User (null = guest booking, with `guestName`/`guestEmail`/`guestPhone` used instead — schema supports this, but the booking flow built so far requires login; see Auth model). Always stores its own `startsAt`/`endsAt` directly. `quantity` (default 1) is how many capacity units one booking claims, letting a group claim several spots in one purchase without the capacity check under/over-counting.
- **Tag** + **ActivityTag** (join table) — many-to-many quick-filter tags for the browse UI. An Activity can carry multiple tags — "Tennis Class" is tagged both "Tennis" and "Classes." `Tag` also carries `emoji`, `color`, `displayOrder` for the browse chip row.
- **AvailabilityOverride** — venue-wide or listing-specific exceptions to the normal booking window: `block` (unavailable) or `open` (available/extends past the window), either a one-off date(s) or a recurring weekly rule (`daysOfWeek`). No admin UI exists to create these yet — currently seed-script-managed only (two sample rows: a `block` on a court, an `open` on a class). See "Booking availability design" below for the resolution rules, which took real iteration to get right.
- **BookingHold** — schema exists (a temporary cart-lock so two people can't finish checkout on the same slot at once) but has **zero consuming code yet** — purely designed, not built. Deferred until the actual booking submission flow (ticket 5.3+) needs it.

**There is deliberately no "Slot" table anywhere in this schema.** Pre-generating discrete bookable time-slot rows doesn't scale once booking duration is variable. Instead: `Booking.startsAt`/`endsAt` are always stored directly against the Listing, and conflict prevention is an **application-level check inside a transaction** — sum the `quantity` of existing non-cancelled Bookings on that Listing whose time range overlaps the requested range, reject if that sum plus the new request would exceed `Listing.capacity` (skipped entirely when capacity is `null`). **This is now implemented** — see `lib/bookings.ts`'s `bookListing`. (A stronger DB-level concurrency guarantee — ticket 5.4 — is still outstanding; the current version is correct but not yet hardened against a true simultaneous race.)

Naming convention: Prisma model/field names are camelCase (idiomatic TS), mapped to snake_case actual Postgres tables/columns via `@map`/`@@map`.

## Auth model

Auth.js is fully implemented: Credentials (email/password via bcrypt) + Google OAuth providers, JWT sessions (required since Credentials can't use database sessions), `auth()`/`signIn()`/`signOut()` exported from `auth.ts`. Real login/signup pages with server actions (`app/login/actions.ts`, `app/signup/actions.ts`).

Three roles: `admin` (full access), `venue_owner` (manage only venues where `Venue.ownerId` matches their own user id — not exclusive, can also browse/book like a normal user elsewhere), `user` (browse/book/manage own bookings).

**Guest checkout**: the schema supports it (nullable `Booking.userId` + guest contact fields), but the booking flow built so far (`bookListing`) **requires login** — a deliberate scope decision for the first working version, not a limitation of the data model. Revisit as its own ticket if guest checkout turns out to matter before launch.

**Authorization pattern** (established convention, use for all future protected actions): `lib/auth-guards.ts` exports `withAuth`/`withRole`, which wrap a Data Access Layer function so it structurally cannot run without a session/role check — there's no code path to the `session` parameter except through the wrapper, so a new protected action can't accidentally skip the check the way a hand-written `if (!session) ...` could be forgotten. `withRole(allowedRoles, fn)` takes the allowed roles as a parameter — one wrapper for every role combination, not one per role. Server Actions stay thin (`app/.../actions.ts`, `"use server"`) and delegate to a `server-only`-marked DAL module (e.g. `lib/bookings.ts`) that holds the real logic — this mirrors Next.js's own documented recommended pattern for this (see `node_modules/next/dist/docs/01-app/02-guides/data-security.md` in this Next.js version), not just a project-specific choice. Role checks alone are **not** sufficient for ownership-scoped authorization (a `venue_owner` role doesn't mean "owns this specific venue") — that needs a separate resource/ownership check inside the action after loading the specific row, the same split Laravel formalizes as Gates (role) vs Policies (ownership). Relevant for the eventual admin/venue-owner UI, not built yet.

## Booking availability design

`lib/availability.ts`'s `getBookableDates(listing)` is the single source of truth for which calendar dates a listing can be booked on, used by both the (future) picker UI and the server-side re-validation. The rules, several of which were deliberately chosen over a more "complete"-seeming alternative:

- **Base window**: today through `Venue.bookingWindowDays` (30 by default), every day for `time_range`/`date_range` (both assumed open daily), or only the matching weekday for `fixed_session`.
- **Override resolution**: a `listing`-scoped override wins over a `venue`-scoped one on the same date. Inside the normal window, a date is available by default unless a `block` says otherwise; beyond the window, a date is unavailable by default unless an `open` says otherwise.
- **No `endDate` at all means the override applies on its `startDate` only** — a single day — regardless of whether `daysOfWeek` is set. This was a deliberate simplification over the originally-documented "recurring + no endDate = indefinite": true indefinite recurrence would need its own cutoff anyway (nothing can really be bookable forever), and since the hard cap below already makes "indefinite" and "ends 90+ days out" functionally identical, supporting true indefinite buys no real capability — only ambiguity (same field meaning two different things depending on another field) and a query that could never prune old rows. If this needs revisiting, do it as a UI default (an "open indefinitely" checkbox that just fills in `endDate = startDate + 90 days`), not a schema/logic change.
- **`MAX_OPEN_EXTENSION_DAYS = 90`** — a hard ceiling on how far an `open` override can push bookability, regardless of its own `endDate`. Without this, one override with a far-future `endDate` could make a listing bookable for a year+ straight.
- **An `open` override can never add a date outside a `fixed_session` listing's own weekday** — the pattern check runs before any override is consulted. A genuinely different one-off occurrence (e.g. a surprise Wednesday class on a normally-Monday-only listing) needs its own `Listing` row, not an override. No admin UI exists yet to create overrides at all, so nothing currently enforces this on the way in — worth a real validation rule once one does.
- Past overrides are excluded from the query itself (not just filtered out by the date logic), since they can never apply to any date the function actually checks.

`isRequestedSlotValid(listing, startsAt, endsAt, bookableDates)` re-derives whether a submitted slot is actually legal per-mechanic (operating hours/increment/duration bounds for `time_range`, day-count bounds for `date_range`, exact occurrence match for `fixed_session`) — the server action calls this itself rather than trusting client input, since a picker UI enforcing the same rules doesn't stop a direct POST request from sending anything.

## MVP scope — explicitly cut, do not build unless asked

Reviews/ratings, real-time notifications, venue-owner/multi-role staff accounts, geolocation-based search (no coordinates exist), real Stripe payouts (test mode only), a full admin UI for managing venues/activities (seed script only), `BookingHold` cart-lock logic, guest checkout for the booking flow (schema-ready, deliberately deferred), true indefinite recurring `AvailabilityOverride` (see "Booking availability design" above for why).

## Current status (update this section as work progresses)

**Phase 0 (setup) — done.** Next.js, Tailwind, Shadcn, Prisma+Supabase connected, git repo with `main`/`dev` branches, deployed to Vercel.

**Phase 1 (data model) — done**, though the schema has kept evolving since (City, AvailabilityOverride, BookingHold, the Resource→Listing rename, `quantity`, `archivedAt`) — expected, not a contradiction; see "Data model" above for the real current shape.

**Phase 2 (Authentication) — done.** See "Auth model" above.

**Phase 3 (seed data) — done.** `prisma/seed.ts` seeds 17 tags, 18 activities, 14 cities, 3 users (2 venue owners, 1 regular user), 9 venues, 68 listings spanning all three booking mechanics, plus 2 sample `AvailabilityOverride` rows.

**Phase 4 (Browse & Discovery) — done.** Shared layout (header/footer/side nav), browse page reading filters entirely from the URL (category, tags, city, price), a listing card component, the listing detail page (`app/listings/[id]/page.tsx`), empty/loading states. Specifics worth knowing:
- **Category is purely mechanic-based** (`All` / `Book a time` / `Classes` / `Multi-day`) — the originally-planned separate "Booking type" sidebar checklist was folded into Category once both turned out to filter on the same axis; Tags stay a fully separate, freely-combinable filter (so "Classes" + "Tennis" together still narrows to Tennis classes specifically).
- **Browse groups results two levels deep**: mechanic (h2, full-width banner) then tag (h3) within it, always rendered (even a single group), since a long scroll with no label is a real usability problem.
- The quick-filter tag chip row excludes "Classes" (redundant with the Category axis now) but the `Tag` row itself is untouched in the DB.
- The detail page shows listing info, full tag list, mechanic-specific schedule line, a Google Maps embed (the key-free `google.com/maps?q=...&output=embed` form — zero setup, zero cost), and a disabled "Booking coming soon" button. A "no longer available" state (prominent, not a bare 404) covers both archived listings and invalid ids. "Back to browse" uses real browser back-navigation (`router.back()`), not a fixed link, so it returns to whatever filters were active.

**Phase 5 (Booking Flow) — in progress.**
- **5.1 (design the booking server action + conflict-check) — done.** `lib/availability.ts` (see "Booking availability design" above), `lib/auth-guards.ts` + `lib/bookings.ts` (see "Auth model" above), `app/listings/[id]/actions.ts` (thin `"use server"` wrapper).
- **5.2 (slot selection UI) — not started.** The next ticket.
- **5.3 (the "Book Now" action itself) — functionally already done by 5.1's `bookListing`** (conflict-check, transaction, tied to the logged-in user); what's left is wiring a real UI trigger to it once 5.2 exists, not writing the action from scratch.
- **5.4 (concurrency hardening), 5.5 (error surfacing), 5.6 (optimistic UI), 5.7 (confirmation step) — not started.**

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
- `prisma migrate reset` run by Claude Code specifically requires the user's explicit, freshly-given consent passed via the `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` env var (Prisma's own agent-safety check) — a prior message's consent earlier in a conversation does not carry forward automatically.

## Other dev-tooling gotchas

- `import "server-only"` at the top of a module only does anything inside Next's own bundler (dev server / `next build`) — running a file that imports it through a bare script (`tsx`, plain `node`) throws unconditionally, since the real npm package has no way to distinguish "server context" outside Next's own build pipeline. Install the real `server-only` package (as Next's own docs suggest) if you need such a file to also be runnable/testable outside Next — but expect to still need the import temporarily removed for a one-off script, since the package always throws when actually executed outside Next's bundler.
- `auth()` (from `auth.ts`) depends on `next/headers`, which only works inside a real Next.js request. It cannot be exercised via a standalone script under any circumstances — there is no bare-script workaround, this has to be tested through the running app.

## Conventions

Ticket IDs follow `phase.subtask` (e.g. `5.4`) and are used as human-readable references in commit messages and on the GitHub Projects board. **Important:** GitHub Issues for this project were created manually, one by one, directly on GitHub — the `create_github_tickets.sh` bulk-creation script was written but never actually run, because it got fiddly to work with. This means GitHub's own auto-assigned issue numbers do **not** match the phase.subtask ticket numbering. If a commit needs to actually link to a GitHub issue (e.g. `closes #N`), `N` must be looked up as that ticket's real GitHub issue number — never assume it equals the phase.subtask number (e.g. ticket `5.3` might actually be GitHub issue `#17`). The phase.subtask number should **not** appear in the commit message text, only the task name, GitHub's #N number to be entered manually on commit. Work happens on a `dev` branch; `main` is production and auto-deploys via Vercel on merge.

## Coding standards

All code written for this project — by Claude or otherwise — must be commented to a professional, production standard: explain intent and non-obvious reasoning (why a decision was made, what edge case is being handled, why one approach was chosen over another), not restate what the code already visibly does. Write comments assuming a new developer with zero prior context on this project needs to read them and pick up the work. Avoid comment noise (e.g. `// create a user` above a line that obviously creates a user) — every comment should earn its place. This is the standard already set in `prisma/seed.ts` and should be matched in every file going forward, to keep the codebase maintainable and easy for any engineer joining the project to pick up.

**Prefer industry-standard, maintainable patterns over the shortest path, even when that costs more upfront complexity.** Concretely: a check that matters for security or correctness (auth, authorization, input validation) should be structural — enforced by the type system or a shared wrapper a function can't be called without going through — rather than a convention every new function has to remember to repeat. Example already in this codebase: `lib/auth-guards.ts`'s `withAuth`/`withRole` wrap Data Access Layer functions (see `lib/bookings.ts`) so a function literally cannot run without a session/role check having already happened, instead of each function starting with its own `if (!session) ...`. This is a deliberate exception to "prefer the simpler, shippable option" elsewhere in this file — scope discipline is about not building unneeded features, not about cutting corners on how the features that do exist are built.
