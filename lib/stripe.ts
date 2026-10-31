import "server-only";
import Stripe from "stripe";

// The only place the Stripe server client is created. Lazy because the SDK
// throws on a missing key, and `next build` imports server modules, so an eager
// client would fail any build without STRIPE_SECRET_KEY.
let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

// One platform currency: listing prices have no currency of their own.
export const PAYMENT_CURRENCY = "aud";

// Stripe amounts are integers in cents. Rounded because hour/day prices can
// carry floating-point noise (e.g. 19.999999).
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

// Which deployment created a payment, stored in its metadata. Development and
// production share one Stripe test account, and Stripe sends every webhook to
// production; the webhook skips payments from other environments instead of
// cancelling them as unmatched. VERCEL_ENV is "production" or "preview" on
// Vercel.
export const PAYMENT_ENV = process.env.VERCEL_ENV ?? "development";
