# PlayBook

[![CI](https://github.com/jaimearamburo/sports-finder-app/actions/workflows/ci.yml/badge.svg)](https://github.com/jaimearamburo/sports-finder-app/actions/workflows/ci.yml)

Discover and book sports courts, fitness classes, day passes and campsites across multiple cities, with live availability and race-safe checkout.

**Live:** [playbook-app-mauve.vercel.app](https://playbook-app-mauve.vercel.app)

![AI search: "racquet sports this weekend in sydney" interpreted as filter chips](docs/screenshots/browse.png)

<table>
  <tr>
    <td><img src="docs/screenshots/booking.png" alt="Picking a court time" /></td>
    <td><img src="docs/screenshots/checkout.png" alt="Checkout with a live hold timer" /></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/my-bookings.png" alt="My Bookings" /></td>
    <td align="center"><img src="docs/screenshots/mobile.png" alt="Mobile browse" width="240" /></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/dashboard-venue.png" alt="Venue manager dashboard: a venue's listings" /></td>
    <td><img src="docs/screenshots/dashboard-listing-editor.png" alt="Listing editor with a photo and a live preview" /></td>
  </tr>
</table>

## What's implemented

- AI-powered natural-language search using an LLM, tolerant of typos and synonyms
- Reserve-then-confirm booking holds with expiring checkout timers
- Stripe payments (test mode): the card is authorized at checkout and charged only once the booking is secured
- Venue manager dashboard: venues, listings (a form per booking type, with a live preview) and bookings, each manager seeing only their own; admins see everything
- Listing photos: uploaded straight from the browser to Vercel Blob with an ownership-checked, single-use permission, and served resized for each screen
- Double-booking protection under concurrent requests (row-level locking)
- One active hold per user, platform-wide
- Three booking models: time slots, recurring classes, multi-day passes and stays
- Live availability that accounts for checkouts in progress
- Multi-city venues across time zones
- Time-zone-correct scheduling, validation and display
- Same-day booking cut-offs derived from opening hours
- Venue and listing availability overrides
- Shared client and server-side validation (Zod)
- Permission-based access control with ownership policies, enforced at the route, page and data layers
- Email/password and Google sign-in
- Security hardening: row-level security, server-enforced business rules, timing-safe login
- WCAG 2.2 AA accessibility, verified with axe-core
- Automated tests: unit tests (Vitest), plus end-to-end access-control and accessibility tests (Playwright, axe-core)
- Responsive, mobile-first UI with streaming loading states

## How a booking works

```mermaid
flowchart LR
  A[Pick a slot] --> B{Hold request<br/>capacity check under row lock}
  B -- full --> R[Rejected]
  B -- available --> C[Checkout<br/>5-minute hold]
  C -- card authorized --> V{Hold still valid?<br/>checked under row lock}
  V -- yes --> D[Payment captured<br/>booking confirmed]
  V -- no --> N[Authorization released<br/>not charged]
  C -- timeout or cancel --> E[Hold released<br/>capacity freed]
```

Requests flow through Server Components and Server Actions into an auth-guarded data layer, then Prisma and PostgreSQL. Capacity checks and the hold-to-booking conversion run inside transactions, so two people can never both secure the last spot.

Payment happens on the checkout page itself (Stripe's Payment Element), inside the hold's time limit. The card is only authorized at first; the money is captured once the server has confirmed the hold is still valid. A payment that arrives too late is released instead, so nobody is charged for a slot they didn't get, and no refunds are needed. A Stripe webhook completes the booking even if the browser closes mid-payment.

## How search works

Search takes plain language, typos included: "tenis in sydny this weekend for free" or "racket sports somewhere warm". An LLM interprets the query into the app's existing filters (activities, city, dates, price) as schema-constrained JSON, limited to values that exist in the database. The result is validated again, shown as editable filter chips, and the regular filters run the search. If the AI call fails, search falls back to keyword matching.

**Why not embeddings?** The catalogue is structured: listings are defined by sport, city, schedule and price, not long descriptions. Searching it is about intent ("this weekend", "free", "racquet sports tomorrow"), which vector similarity can't express without several extra parsing layers, and typos break most date parsers. Query understanding handles intent, synonyms, typos, dates and price in one validated step. Embeddings are the better tool for ranking large, text-heavy catalogues, and could later be added as a ranking step within the filtered results.

**Why Haiku 5.5?** Mapping a short query onto a small, schema-enforced vocabulary is extraction, not deep reasoning. A small, fast model meets the real requirements: low latency and low cost per search. The evaluation set decides if a larger model is ever needed.

**Tested with evals.** A 26-query eval set runs the real model against expected filters: typos, synonyms, dates, prices, booking-type rules, nonsense and a prompt-injection attempt. Injection is contained by design: the output must pass a Zod schema whose tags and cities are enums of real database values, so even a manipulated response can only produce valid filters. Current result: 26/26.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui (Base UI) · Prisma 7 · PostgreSQL (Supabase) · Auth.js v5 · Zod 4 · Stripe · LLM (structured outputs) · Vercel

## Running locally

Requires Node 20.9+, pnpm and a PostgreSQL database.

```bash
pnpm install
# .env: POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING, AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, LLM_API_KEY,
#       STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET, BLOB_READ_WRITE_TOKEN
# Listing photos need a public Vercel Blob store; put its hostname in LISTING_IMAGE_HOST (lib/listing-images.ts)
# Optional one-click demo logins: DEMO_LOGIN_ENABLED=true, DEMO_OWNER_EMAIL, DEMO_USER_EMAIL (never an admin)
pnpm exec prisma migrate deploy
SEED_USER_PASSWORD=<choose one> pnpm exec prisma db seed   # sample owner and user accounts get this password
pnpm dev
pnpm test   # unit tests

pnpm exec playwright install chromium   # once, for the end-to-end tests
pnpm test:e2e   # creates its own test accounts and data, and removes them afterwards
```

## Next up

Embedding-based result ranking · booking cancellation and refunds · rate limiting and email verification · guest checkout · dark theme · availability overrides in the dashboard
