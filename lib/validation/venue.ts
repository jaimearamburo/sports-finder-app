import { z } from "zod";
import { NAME_MAX_LENGTH } from "./common";

// The venue form's rules, shared by the form and the server
// (createVenue/updateVenue always parse). Shape only: the city's existence and
// the user's rights are checked in lib/dashboard/venues.ts.

// Rolling booking window, up to six months; overrides can open single dates
// beyond it.
export const BOOKING_WINDOW_DAYS = { min: 1, max: 180 } as const;
// How long checkout holds a slot: long enough to enter card details, short
// enough to free abandoned slots soon.
export const HOLD_DURATION_MINUTES = { min: 2, max: 30 } as const;

// A new venue's starting values; matches the column defaults in schema.prisma.
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
  // Empty is stored as null, not "".
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
  // Shape only: whether it's used depends on who's saving (resolveOwnerId in
  // lib/dashboard/venues.ts).
  ownerId: z.string().max(64).optional(),
});

export type VenueInput = z.input<typeof venueSchema>;
