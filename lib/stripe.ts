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
