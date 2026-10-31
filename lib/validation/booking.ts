import { z } from "zod";
import { emailField, NAME_MAX_LENGTH } from "./common";

// Runtime shapes for the booking Server Actions' inputs: TypeScript types don't
// stop a crafted POST sending a string as a Date or "2" as quantity. Parsed at
// the top of each DAL function in lib/bookings.ts, so no caller skips them.
// Shape only; rules that need the database stay in lib/bookings.ts and
// lib/availability.ts. Not server-only, so CheckoutForm reuses the attendee
// rules.

// Loose on purpose: phone formats vary by country, and the field is optional.
const PHONE_PATTERN = /^[+\d\s()-]{6,20}$/;

export const attendeeSchema = z.object({
  attendeeName: z
    .string()
    .trim()
    .min(1, { error: "Enter the attendee's full name." })
    .max(NAME_MAX_LENGTH, { error: `Name must be ${NAME_MAX_LENGTH} characters or fewer.` }),
  attendeeEmail: emailField,
  // "" and missing both become undefined, stored as null.
  attendeePhone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || PHONE_PATTERN.test(v), { error: "Enter a valid phone number." })
    .transform((v) => v || undefined),
});

export const createHoldSchema = z.object({
  listingId: z.string().min(1),
  // Real Dates only (Server Actions serialise Dates natively). The max bounds
  // the per-slot loop; a real pass can't exceed the bookable window
  // (MAX_OPEN_EXTENSION_DAYS), so 100 never rejects a genuine request.
  slots: z
    .array(z.object({ startsAt: z.date(), endsAt: z.date() }))
    .min(1)
    .max(100),
  // A zero or negative quantity would dodge the capacity check and skew every
  // later capacity sum.
  quantity: z.number().int().min(1).optional(),
});

// The attendee details are final at payment start: they travel in the
// PaymentIntent's metadata so the webhook can complete the booking without the
// browser.
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
