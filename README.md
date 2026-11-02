# PlayBook

[![CI](https://github.com/jaimearamburo/sports-finder-app/actions/workflows/ci.yml/badge.svg)](https://github.com/jaimearamburo/sports-finder-app/actions/workflows/ci.yml)

A booking app for sports courts, fitness classes, day passes and campsites across several cities.

**Live:** [playbook-app-mauve.vercel.app](https://playbook-app-mauve.vercel.app). Use the demo buttons on the login page to sign in as a regular user or a venue owner. Payments are in Stripe test mode: card 4242 4242 4242 4242, any future date, any CVC.

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS · Prisma · PostgreSQL · Auth.js · Stripe · Vercel Blob · Claude Haiku · Vercel

![Search for "racquet sports this weekend in sydney", turned into filters](docs/screenshots/browse.png)

## Highlights

- **No double bookings.** Two people can't book the last spot at the same time. A test sends simultaneous requests and checks that exactly one succeeds.
- **No charge without a booking.** The card is only authorized at checkout. The money is taken after the booking is saved, so a late payment is released instead of refunded.
- **Plain-language grounded LLM based search.** "tenis in sydny ths weekend for free" becomes regular filters. The model can only choose from values that exist in the database, and search still works if it fails.
- **Venue dashboard.** Owners manage their venues, listings, photos and bookings. They only ever see their own.

## How a booking works

```mermaid
flowchart LR
  A[Pick a slot] --> B{Spot free?}
  B -- no --> R[Rejected]
  B -- yes --> C[Checkout<br/>slot held 5 minutes]
  C -- card authorized --> V{Hold still valid?}
  V -- yes --> D[Charged<br/>booking confirmed]
  V -- no --> N[Authorization released<br/>not charged]
  C -- timeout or cancel --> E[Slot freed]
```

Clicking Book Now holds the slot for N minutes. The capacity check locks the listing's row in the database, so a second request waits for the first to finish. A Stripe webhook finishes the booking if the customer closes the tab after paying.

## Design decisions

| Decision | Why |
| --- | --- |
| Pay on the site, not on Stripe's hosted page | A hosted Stripe session stays open at least 30 minutes, much longer than the per-venue set N-minute hold |
| Authorize first, charge later | Nobody pays for a slot they didn't get, and there are no refunds to manage |
| One booking in progress per user | Simpler and more reliable than detecting when someone leaves the checkout page |
| No table of time slots | Bookings have variable lengths, so availability is calculated from existing bookings |
| AI search is grounded, the AI model turns the query into filters, no embeddings | Listings are structured (sport, city, date, price), and queries like "this weekend" need exact dates, not similarity |
| Small, fast model (Haiku) | The job is picking from a short list, so speed and cost matter more than reasoning for this use case |

## Testing

| Type | Tool | What it covers |
| --- | --- | --- |
| Unit | Vitest | Booking rules, dates and time zones, prices, permissions, form validation |
| Database | Vitest + Postgres | Simultaneous bookings, payments completed twice, expired holds, failed charges |
| End to end | Playwright | A full paid booking, who can access the dashboard, accessibility (axe) |
| AI Search | Eval script | 26 queries with typos, dates, prices and a prompt injection attempt: 26/26 |

CI runs type checks, lint, unit tests and the database tests on every pull request.

## Environments

- Development and production have separate databases and image storage.
- Database migrations run automatically on production deploys only.
- Work is planned as GitHub issues and merged from `dev` to `main` through pull requests.

## Not built yet

Booking cancellation and refunds · guest checkout · rate limiting and email verification · booking confirmation email · an admin screen for cities and activities

## Running locally

Needs Node 20.9+, pnpm and a PostgreSQL database of your own (for example a free Neon project).

```bash
pnpm install
cp .env.example .env              # fill in your own keys
pnpm exec prisma migrate deploy
pnpm exec prisma db seed
pnpm dev

pnpm test                         # unit tests
pnpm test:db                      # database tests
pnpm exec playwright install chromium
pnpm test:e2e                     # end-to-end tests
```

<details>
<summary>More screenshots</summary>

<table>
  <tr>
    <td><img src="docs/screenshots/booking.png" alt="Picking a court time" /></td>
    <td><img src="docs/screenshots/checkout.png" alt="Checkout with the hold timer" /></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/my-bookings.png" alt="My Bookings" /></td>
    <td align="center"><img src="docs/screenshots/mobile.png" alt="Browse on a phone" width="240" /></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/dashboard-venue.png" alt="Venue dashboard: a venue's listings" /></td>
    <td><img src="docs/screenshots/dashboard-listing-editor.png" alt="Listing editor with a live preview" /></td>
  </tr>
</table>

</details>
