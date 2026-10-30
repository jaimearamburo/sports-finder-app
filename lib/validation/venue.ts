import { z } from "zod";
import { NAME_MAX_LENGTH } from "./common";

// The venue form's rules, shared by the form (instant inline errors) and
// the server (the real check - a Server Action is a public endpoint, so
// createVenue/updateVenue parse their input regardless of what the browser
// did). Shape only: whether the chosen city exists and whether the user may
// edit this venue are checked in lib/dashboard/venues.ts, against the
// database.

// How far ahead people can book. A rolling window of up to six months; the
// availability code can extend single dates past it with overrides.
export const BOOKING_WINDOW_DAYS = { min: 1, max: 180 } as const;
// How long a slot is held while someone checks out. Long enough to type
// card details, short enough that an abandoned checkout frees the slot
// soon. The checkout page and payment flow are built around a few minutes.
export const HOLD_DURATION_MINUTES = { min: 2, max: 30 } as const;

// What a new venue's form starts with. Matches the column defaults in
// prisma/schema.prisma (Venue.bookingWindowDays, Venue.holdDurationMinutes).
export const NEW_VENUE_DEFAULTS = { bookingWindowDays: 30, holdDurationMinutes: 5 } as const;

const DESCRIPTION_MAX_LENGTH = 1000;
const ADDRESS_MAX_LENGTH = 200;

function wholeNumber(label: string, { min, max }: { min: number; max: number }) {
  return z
    .number({ error: `Enter ${label} as a whole number.` })
    .int({ error: `Enter ${label} as a whole number.` })
    .min(min, { error: `${capitalise(label)} must be between ${min} and ${max}.` })
    .max(max, { error: `${capitalise(label)} must be between ${min} and ${max}.` });
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const venueSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Enter the venue's name." })
    .max(NAME_MAX_LENGTH, { error: `Name must be ${NAME_MAX_LENGTH} characters or fewer.` }),
  // Optional. An empty box is stored as no description (null), not "".
  description: z
    .string()
    .trim()
    .max(DESCRIPTION_MAX_LENGTH, { error: `Description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer.` })
    .transform((value) => value || null),
  address: z
    .string()
    .trim()
    .min(1, { error: "Enter the venue's street address." })
    .max(ADDRESS_MAX_LENGTH, { error: `Address must be ${ADDRESS_MAX_LENGTH} characters or fewer.` }),
  cityId: z.string().min(1, { error: "Choose a city." }).max(64),
  bookingWindowDays: wholeNumber("the booking window", BOOKING_WINDOW_DAYS),
  holdDurationMinutes: wholeNumber("the hold time", HOLD_DURATION_MINUTES),
  // Who owns the venue. Shape only, and optional here: whether it's used at
  // all, required, or ignored depends on who's saving (only users who may
  // assign owners can set it - see resolveOwnerId in
  // lib/dashboard/venues.ts), which a schema can't know.
  ownerId: z.string().max(64).optional(),
});

export type VenueInput = z.input<typeof venueSchema>;
