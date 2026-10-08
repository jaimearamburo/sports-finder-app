# Sports Booking App — MVP Task Breakdown

**Stack:** Next.js (App Router) + TypeScript, Shadcn UI (built on Tailwind + Radix), PostgreSQL via Supabase, Prisma ORM, Auth.js (NextAuth), Stripe (test mode).

Tasks are grouped by core feature (phase) and ordered by dependency. Each phase is numbered, each subtask is numbered `phase.subtask` (e.g. `5.3`) as a local reference ID for this document only.

**Important — commit messages:** GitHub Issues for this project are tracked separately on the GitHub Projects board, and their issue numbers do **not** match the `phase.subtask` numbering used here. Before writing a commit message that links to a GitHub issue (e.g. `closes #N`), always look up — or ask — for that ticket's actual GitHub issue number first; never assume it matches the local `phase.subtask` ID. The `phase.subtask` ID can still appear in the commit message text for readability, but it is not the number GitHub uses for linking.

---

## Phase 0 — Project Setup & Foundations
- [ ] **0.1** Initialize Next.js project with App Router + TypeScript
- [ ] **0.2** Install and configure Tailwind CSS + Shadcn UI
- [ ] **0.3** Initialize Git repo, add `.gitignore`, make first commit (push to GitHub)
- [ ] **0.4** Create Supabase project, grab Postgres connection string
- [ ] **0.5** Install Prisma, connect to Supabase, confirm connection works
- [ ] **0.6** Set up `.env.local` and a checked-in `.env.example`
- [ ] **0.7** Connect repo to Vercel and deploy a placeholder page
- [ ] **0.8** Set up base folder structure (`app/`, `components/`, `lib/`, `types/`)

## Phase 1 — Data Model
- [ ] **1.1** List out entities and relationships: User, Venue, Activity, Slot, Booking
- [ ] **1.2** Write the Prisma schema (fields + relations) for all entities
- [x] **1.3** ~~Add the unique constraint on Slot booking that will prevent double-booking later~~ — **Superseded.** The Slot table was dropped from the design; double-booking prevention is now an application-level check (count overlapping active bookings vs. Resource.capacity, inside a transaction) rather than a DB constraint. This work now belongs to ticket 5.4, not here.
- [ ] **1.4** Run first migration against Supabase
- [ ] **1.5** Verify tables in Supabase dashboard or Prisma Studio
- [ ] **1.6** Write the skeleton of a seed script (no data yet, just structure)

## Phase 2 — Authentication
*(Depends on: Phase 1 — User model must exist)*
- [ ] **2.1** Install and configure Auth.js
- [ ] **2.2** Connect Auth.js to Prisma/Supabase via the adapter so users persist in the DB
- [ ] **2.3** Configure at least one provider (credentials, or Google OAuth, or both)
- [ ] **2.4** Build sign-up page/flow
- [ ] **2.5** Build login page/flow
- [ ] **2.6** Build logout functionality
- [ ] **2.7** Set up server-side session access (for use in server components/actions)
- [ ] **2.8** Add middleware/route protection for authenticated-only routes
- [ ] **2.9** Test the full flow end-to-end: sign up → login → hit protected route → logout

## Phase 3 — Seed Data
*(Depends on: Phase 1)*
- [ ] **3.1** Define realistic sample data — a handful of venues, activities (tennis, padel, basketball, gym class), and time slots
- [ ] **3.2** Write and run the full seed script
- [ ] **3.3** Verify seeded data looks correct in Prisma Studio

## Phase 4 — Browse & Discovery
*(Depends on: Phase 3 — needs data to display)*
- [ ] **4.1** Build shared layout (header, nav, footer)
- [ ] **4.2** Build the "browse activities" page as a server component fetching from the DB
- [ ] **4.3** Build filter UI (sport type, location, date)
- [ ] **4.4** Wire filters to a real server-side query (via search params)
- [ ] **4.5** Build the activity/venue card component for the list view
- [ ] **4.6** Build the activity/venue detail page (dynamic route) showing info + available slots
- [ ] **4.7** Add empty-state and loading-state handling for these pages

## Phase 5 — Booking Flow (core feature)
*(Depends on: Phase 2 auth + Phase 4 detail page)*
- [ ] **5.1** Design the booking server action, including the conflict-check logic
- [ ] **5.2** Build slot selection UI on the detail page
- [ ] **5.3** Implement the "Book Now" server action, creating a Booking tied to the logged-in user
- [ ] **5.4** Make booking concurrency-safe (DB constraint/transaction so a double-booking attempt fails cleanly)
- [ ] **5.5** Handle and surface booking errors in the UI (slot already taken, not logged in, etc.)
- [ ] **5.6** Add optimistic UI update when a booking is made
- [ ] **5.7** Build confirmation step/redirect after a successful booking

## Phase 6 — Payments (Stripe test mode)
*(Depends on: Phase 5 — needs a booking to attach payment to)*
- [ ] **6.1** Create a Stripe account, enable test mode, grab API keys
- [ ] **6.2** Install Stripe SDK, add keys to env
- [ ] **6.3** Implement Stripe Checkout (redirect flow — fastest to build correctly)
- [ ] **6.4** Create a checkout session server action tied to a specific booking
- [ ] **6.5** Build success and cancel redirect pages
- [ ] **6.6** Mark the booking as paid on successful checkout (webhook or redirect-based confirmation)
- [ ] **6.7** Test the full payment flow with a Stripe test card

## Phase 7 — User Dashboard
*(Depends on: Phase 5, and Phase 6 if you want paid status shown)*
- [ ] **7.1** Build "My Bookings" page, fetching bookings for the logged-in user
- [ ] **7.2** Split into upcoming vs past bookings
- [ ] **7.3** Implement a cancel-booking server action (frees up the slot again)
- [ ] **7.4** Add optimistic UI update for cancellation
- [ ] **7.5** Handle the empty state (no bookings yet)

## Phase 8 — Polish & UX
*(Do last, across the whole app)*
- [ ] **8.1** Full responsive pass — mobile, tablet, desktop
- [ ] **8.2** Add `loading.tsx` / `error.tsx` / `not-found.tsx` for key routes
- [ ] **8.3** Add client + server form validation (Zod recommended)
- [ ] **8.4** Consistency pass on Shadcn components/design system
- [ ] **8.5** Basic accessibility check — labels, alt text, keyboard navigation

## Phase 9 — Deployment & Documentation
- [ ] **9.1** Final env var audit for production (Vercel + Supabase + Stripe keys all set correctly)
- [ ] **9.2** Verify the full flow works on the live production URL, not just localhost
- [ ] **9.3** Write the README: overview, tech stack, architecture decisions, screenshots, live link, local setup instructions
- [ ] **9.4** Add a "future work / intentionally cut" section to the README
- [ ] **9.5** Final QA pass — walk the entire user journey once, start to finish
