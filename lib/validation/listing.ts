import { z } from "zod";
import { NAME_MAX_LENGTH } from "./common";

// The listing form's rules, one set per kind of listing, shared by the form
// (instant inline errors) and the server (the real check: createListing and
// updateListing parse their input regardless of what the browser did).
//
// The rules exist to keep every saved listing bookable. They mirror what the
// booking code assumes (lib/availability.ts isRequestedSlotValid, the
// pickers in components/listings/):
// - Courts: the time picker offers start times by stepping from opening
//   time, and the server only accepts starts that sit exactly on the step
//   counted from midnight - so opening and closing times, and the shortest
//   and longest booking, must all fall on the step, or some advertised times
//   could never be booked.
// - Passes need opening hours (shown on the listing, and closing time drives
//   the same-day cut-off); stays need a check-in deadline for the same reason.
// - Classes need a weekday, start time and length to place each session.

export type ListingKind = "court" | "pass" | "stay" | "class";

// Which form a listing gets is decided by its activity: the activity's
// booking mechanic, plus, for multi-day activities, whether it's a stay.
export function listingKindFor(activity: {
  bookingMechanic: "time_range" | "date_range" | "fixed_session";
  isAccommodation: boolean;
}): ListingKind {
  switch (activity.bookingMechanic) {
    case "time_range":
      return "court";
    case "date_range":
      return activity.isAccommodation ? "stay" : "pass";
    case "fixed_session":
      return "class";
  }
}

export const START_STEP_OPTIONS = [15, 30, 60] as const;
export const PRICE_MAX = 10000;
export const CAPACITY_MAX = 1000;
export const MAX_PER_BOOKING_MAX = 50;
export const DAYS_MAX = 30;
export const SESSION_MINUTES = { min: 15, max: 480 } as const;
// The longest a court booking can be: a full day's opening hours is the
// real limit, this just keeps the duration list a sensible length.
export const COURT_DURATION_MAX_MINUTES = 8 * 60;

const DESCRIPTION_MAX_LENGTH = 1000;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function minutesOf(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// "90" -> "1 hr 30 min", "60" -> "1 hr", "45" -> "45 min".
export function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
}

const time = (label: string) =>
  z.string({ error: `Enter ${label}.` }).regex(TIME_PATTERN, { error: `Enter ${label} as a time, like 09:00.` });

const wholeNumber = (label: string, min: number, max: number) =>
  z
    .number({ error: `Enter ${label} as a whole number.` })
    .int({ error: `Enter ${label} as a whole number.` })
    .min(min, { error: `${label.charAt(0).toUpperCase()}${label.slice(1)} must be between ${min} and ${max}.` })
    .max(max, { error: `${label.charAt(0).toUpperCase()}${label.slice(1)} must be between ${min} and ${max}.` });

// Fields every kind of listing has.
const baseFields = {
  activityId: z.string().min(1, { error: "Choose an activity." }).max(64),
  name: z
    .string()
    .trim()
    .min(1, { error: "Enter the listing's name." })
    .max(NAME_MAX_LENGTH, { error: `Name must be ${NAME_MAX_LENGTH} characters or fewer.` }),
  description: z
    .string()
    .trim()
    .max(DESCRIPTION_MAX_LENGTH, { error: `Description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer.` })
    .transform((value) => value || null),
  price: z
    .number({ error: "Enter a price, or 0 for free." })
    .min(0, { error: "The price can't be negative." })
    .max(PRICE_MAX, { error: `The price must be $${PRICE_MAX.toLocaleString("en-AU")} or less.` })
    // Whole cents only: prices are stored to two decimal places and charged
    // in cents, so $10.005 would be rounded silently otherwise.
    .refine((value) => Math.abs(Math.round(value * 100) - value * 100) < 1e-6, {
      error: "Use at most two decimal places.",
    }),
  // null: unlimited (only offered for classes and passes - see the form).
  capacity: wholeNumber("capacity", 1, CAPACITY_MAX).nullable(),
  // How many places one booking can take. Only asked for when a listing
  // takes more than one person; otherwise it's 1 by definition.
  maxPerBooking: wholeNumber("the limit per booking", 1, MAX_PER_BOOKING_MAX),
};

type Issue = { path: string; message: string };

// Rules that compare fields. Each returns the problems found, attached to
// the field a person would fix.
function capacityIssues(data: { capacity: number | null; maxPerBooking: number }): Issue[] {
  if (data.capacity !== null && data.maxPerBooking > data.capacity) {
    return [{ path: "maxPerBooking", message: "Can't be more than the capacity." }];
  }
  return [];
}

function addIssues(ctx: z.RefinementCtx, issues: Issue[]) {
  for (const issue of issues) ctx.addIssue({ code: "custom", path: [issue.path], message: issue.message });
}

const courtSchema = z
  .object({
    ...baseFields,
    capacity: wholeNumber("capacity", 1, CAPACITY_MAX),
    openingTime: time("an opening time"),
    closingTime: time("a closing time"),
    startStepMinutes: z.union(START_STEP_OPTIONS.map((step) => z.literal(step)), {
      error: "Choose how often bookings can start.",
    }),
    minDurationMinutes: wholeNumber("the shortest booking", 5, COURT_DURATION_MAX_MINUTES),
    maxDurationMinutes: wholeNumber("the longest booking", 5, COURT_DURATION_MAX_MINUTES),
  })
  .superRefine((data, ctx) => {
    const open = minutesOf(data.openingTime);
    const close = minutesOf(data.closingTime);
    const step = data.startStepMinutes;
    const issues: Issue[] = [...capacityIssues(data)];
    if (open % step !== 0) issues.push({ path: "openingTime", message: `Must be on a ${step}-minute mark, like 08:00.` });
    if (close % step !== 0) issues.push({ path: "closingTime", message: `Must be on a ${step}-minute mark, like 22:00.` });
    if (close <= open) issues.push({ path: "closingTime", message: "Must be after the opening time." });
    if (data.minDurationMinutes % step !== 0)
      issues.push({ path: "minDurationMinutes", message: `Must be a multiple of ${step} minutes.` });
    if (data.maxDurationMinutes % step !== 0)
      issues.push({ path: "maxDurationMinutes", message: `Must be a multiple of ${step} minutes.` });
    if (data.maxDurationMinutes < data.minDurationMinutes)
      issues.push({ path: "maxDurationMinutes", message: "Can't be shorter than the shortest booking." });
    if (close > open && data.minDurationMinutes > close - open)
      issues.push({ path: "minDurationMinutes", message: "Longer than the opening hours." });
    else if (close > open && data.maxDurationMinutes > close - open)
      issues.push({ path: "maxDurationMinutes", message: "Longer than the opening hours." });
    addIssues(ctx, issues);
  });

const dayRange = {
  minDays: wholeNumber("the minimum", 1, DAYS_MAX),
  maxDays: wholeNumber("the maximum", 1, DAYS_MAX),
};

const passSchema = z
  .object({ ...baseFields, openingTime: time("an opening time"), closingTime: time("a closing time"), ...dayRange })
  .superRefine((data, ctx) => {
    const issues: Issue[] = [...capacityIssues(data)];
    if (minutesOf(data.closingTime) <= minutesOf(data.openingTime))
      issues.push({ path: "closingTime", message: "Must be after the opening time." });
    if (data.maxDays < data.minDays) issues.push({ path: "maxDays", message: "Can't be fewer than the minimum." });
    addIssues(ctx, issues);
  });

const staySchema = z
  .object({
    ...baseFields,
    capacity: wholeNumber("capacity", 1, CAPACITY_MAX),
    // The latest someone can check in. Also when same-day bookings close.
    closingTime: time("a check-in deadline"),
    ...dayRange,
  })
  .superRefine((data, ctx) => {
    const issues: Issue[] = [...capacityIssues(data)];
    if (data.maxDays < data.minDays) issues.push({ path: "maxDays", message: "Can't be fewer than the minimum." });
    addIssues(ctx, issues);
  });

const classSchema = z
  .object({
    ...baseFields,
    weekday: wholeNumber("the day", 0, 6),
    startTime: time("a start time"),
    sessionMinutes: wholeNumber("the session length", SESSION_MINUTES.min, SESSION_MINUTES.max),
  })
  .superRefine((data, ctx) => {
    const issues: Issue[] = [...capacityIssues(data)];
    if (minutesOf(data.startTime) + data.sessionMinutes > 24 * 60)
      issues.push({ path: "sessionMinutes", message: "The session must finish by midnight." });
    addIssues(ctx, issues);
  });

export const LISTING_SCHEMAS = { court: courtSchema, pass: passSchema, stay: staySchema, class: classSchema };

export type CourtInput = z.input<typeof courtSchema>;
export type PassInput = z.input<typeof passSchema>;
export type StayInput = z.input<typeof staySchema>;
export type ClassInput = z.input<typeof classSchema>;

// Everything the form can send. Each kind's schema reads only its own
// fields, so the rest are simply ignored.
export type ListingFormInput = {
  activityId: string;
  name: string;
  description: string;
  price: number;
  capacity: number | null;
  maxPerBooking: number;
  openingTime: string;
  closingTime: string;
  startStepMinutes: number;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  minDays: number;
  maxDays: number;
  weekday: number;
  startTime: string;
  sessionMinutes: number;
};

export type ListingFieldErrors = Partial<Record<keyof ListingFormInput, string>>;

export type ParsedListing =
  | ({ kind: "court" } & z.output<typeof courtSchema>)
  | ({ kind: "pass" } & z.output<typeof passSchema>)
  | ({ kind: "stay" } & z.output<typeof staySchema>)
  | ({ kind: "class" } & z.output<typeof classSchema>);

// The one entry point: validates input against its kind's rules and returns
// either the cleaned values or one message per field.
export function parseListing(
  kind: ListingKind,
  input: ListingFormInput
): { ok: true; data: ParsedListing } | { ok: false; fieldErrors: ListingFieldErrors } {
  const result = LISTING_SCHEMAS[kind].safeParse(input);
  if (!result.success) {
    const fieldErrors: ListingFieldErrors = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof ListingFormInput | undefined;
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { ok: false, fieldErrors };
  }
  return { ok: true, data: { kind, ...result.data } as ParsedListing };
}

// What a new listing's form starts with once its activity is chosen - the
// common case for each kind, so a manager usually only adjusts a few
// fields. Also fills in the fields a kind doesn't use, so the form always
// has a complete set to switch between kinds without losing typed values.
export const NEW_LISTING_DEFAULTS: Omit<ListingFormInput, "activityId" | "name" | "description" | "price"> = {
  capacity: 1,
  maxPerBooking: 1,
  openingTime: "08:00",
  closingTime: "22:00",
  startStepMinutes: 30,
  minDurationMinutes: 60,
  maxDurationMinutes: 120,
  minDays: 1,
  maxDays: 1,
  weekday: 1,
  startTime: "18:00",
  sessionMinutes: 60,
};

// Per-kind adjustments on top of NEW_LISTING_DEFAULTS, applied when a new
// listing's activity is chosen: classes and passes are usually shared
// (several people per session or day), courts and stays exclusive.
export const KIND_DEFAULTS: Record<ListingKind, Partial<ListingFormInput>> = {
  court: { capacity: 1, maxPerBooking: 1 },
  pass: { capacity: 50, maxPerBooking: 5, openingTime: "06:00", closingTime: "22:00", minDays: 1, maxDays: 1 },
  stay: { capacity: 1, maxPerBooking: 1, closingTime: "20:00", minDays: 1, maxDays: 7 },
  class: { capacity: 20, maxPerBooking: 5 },
};
