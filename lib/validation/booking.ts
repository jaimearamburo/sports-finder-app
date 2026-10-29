import { z } from "zod";
import { emailField, NAME_MAX_LENGTH } from "./common";

// Runtime shapes for the booking Server Actions' inputs. Their TypeScript
// argument types are compile-time only - a hand-crafted POST can send a
// string where a Date belongs, an object as listingId, "2" as quantity -
// and without these, that reached .getTime()/.trim() deep in lib/bookings.ts
// and surfaced as a 500 instead of a clean { ok: false } result. Parsed at
// the top of each DAL function (inside withAuth), not in the thin
// actions.ts, so no caller can reach the logic without passing through
// them. Business rules that need the database (capacity, operating hours,
// maxBookingsPerTransaction, hold ownership/expiry) deliberately stay in
// lib/bookings.ts and lib/availability.ts - these only check shape.
// A plain module, not server-only, so CheckoutForm can reuse the attendee
// rules for instant feedback.

// Loose on purpose: digits, spaces, "+", "-", "()" and a sane length.
// Phone formats vary too much by country to validate strictly, and the
// field is optional - this only stops obvious junk.
const PHONE_PATTERN = /^[+\d\s()-]{6,20}$/;

export const attendeeSchema = z.object({
  attendeeName: z
    .string()
    .trim()
    .min(1, { error: "Enter the attendee's full name." })
    .max(NAME_MAX_LENGTH, { error: `Name must be ${NAME_MAX_LENGTH} characters or fewer.` }),
  attendeeEmail: emailField,
  // "" and missing both mean "no phone given," normalised to undefined so
  // the DAL stores null either way.
  attendeePhone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || PHONE_PATTERN.test(v), { error: "Enter a valid phone number." })
    .transform((v) => v || undefined),
});

export const createHoldSchema = z.object({
  listingId: z.string().min(1),
  // Server Actions serialise Date natively, so a genuine client always
  // sends real Dates here - anything else is a crafted request. The max is
  // just a ceiling on how big an array the per-slot loop will ever accept:
  // a legitimate multi-day pass can never exceed the bookable window
  // (capped at 90 days past today by MAX_OPEN_EXTENSION_DAYS in
  // lib/availability.ts, not imported here to keep this module
  // client-safe), so 100 never rejects a real request.
  slots: z
    .array(z.object({ startsAt: z.date(), endsAt: z.date() }))
    .min(1)
    .max(100),
  // A crafted 0 or negative quantity would otherwise dodge the capacity
  // check and permanently corrupt the listing's remaining-capacity math,
  // since quantity is summed into every later overlap query.
  quantity: z.number().int().min(1).optional(),
});

// Starting payment is the point where the attendee details are final:
// they travel with the PaymentIntent (as metadata), so the payment webhook
// can complete the booking even if the browser never comes back.
export const startPaymentSchema = attendeeSchema.extend({
  orderId: z.uuid(),
});

export const confirmPaymentSchema = z.object({
  orderId: z.uuid(),
  // Stripe PaymentIntent ids always start with "pi_".
  paymentIntentId: z.string().startsWith("pi_").max(255),
});

export const releaseHoldSchema = z.object({
  orderId: z.uuid(),
});
