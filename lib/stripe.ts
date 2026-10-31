import "server-only";
import Stripe from "stripe";

// The only place the Stripe server client is created. Lazy, not a module-
// level `new Stripe(...)`: the SDK throws on a missing key at construction,
// and `next build` imports server modules while collecting page data, so an
// eager client would fail any build that runs without STRIPE_SECRET_KEY set.
// The key has no NEXT_PUBLIC_ prefix and this module is server-only, so it
// can never reach browser code.
let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

// One platform currency for every venue. Listing prices are stored as plain
// numbers with no currency of their own, so payments use a single currency
// until a per-venue currency exists.
export const PAYMENT_CURRENCY = "aud";

// Stripe amounts are integers in the currency's smallest unit (cents).
// Rounded, because prices computed from hours or days can carry
// floating-point noise (e.g. 19.999999).
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

// Which deployment created a payment, stored in its metadata. Local
// development and production share one Stripe test account but not a
// database, and Stripe sends every webhook to the production URL. Without
// this, production would receive a locally made payment, find no matching
// order in its own database, treat it as unmatched and cancel it - breaking
// the local checkout. The webhook skips payments from other environments.
// Vercel sets VERCEL_ENV ("production" or "preview"); anywhere else it's
// local development.
export const PAYMENT_ENV = process.env.VERCEL_ENV ?? "development";
