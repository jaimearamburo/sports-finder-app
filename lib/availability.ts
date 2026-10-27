import "server-only";
import { TZDate } from "@date-fns/tz";
import type { Activity, AvailabilityOverride, City, Listing, Venue } from "../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  minutesSinceMidnight,
  zonedOccurrenceStart,
  minutesOfDayInTimezone,
  calendarDayInTimezone,
  isSameDayBookingClosed,
} from "@/lib/time-of-day";
import { addDays, startOfUTCDay, todayInTimezone } from "@/lib/dates";

type AvailabilityListing = Listing & {
  // city.timezone, not just bookingWindowDays - every date/time
  // computation in this file is anchored to the venue's own timezone (see
  // todayInTimezone/zonedOccurrenceStart/etc.), not the server's or the
  // viewer's.
  venue: Pick<Venue, "bookingWindowDays"> & { city: Pick<City, "timezone"> };
  activity: Pick<Activity, "bookingMechanic">;
};

// Does this override apply on a given calendar date? No endDate at all
// means it applies on startDate only - a single day - whether or not
// daysOfWeek is set; daysOfWeek is only actually consulted once an
// endDate makes it a real range to recur across. This deliberately
// avoids a true "indefinite" case, which would have no natural cutoff
// for how far into the future getBookableDates could ever stop looking.
function overrideAppliesOn(override: AvailabilityOverride, date: Date): boolean {
  if (date < override.startDate) return false;
  if (!override.endDate) return date.getTime() === override.startDate.getTime();
  if (date > override.endDate) return false;
  return override.daysOfWeek.length === 0 || override.daysOfWeek.includes(date.getUTCDay());
}

// Listing-level overrides win over venue-level ones on the same date -
// e.g. a venue-wide closure with one court still open through it.
function resolveOverrideKind(
  date: Date,
  overrides: AvailabilityOverride[],
  listingId: string
): "block" | "open" | undefined {
  const listingOverride = overrides.find((o) => o.listingId === listingId && overrideAppliesOn(o, date));
  if (listingOverride) return listingOverride.kind;
  const venueOverride = overrides.find((o) => o.listingId === null && overrideAppliesOn(o, date));
  return venueOverride?.kind;
}

// Hard ceiling on how far an "open" override can push bookability past
// the venue's normal window, regardless of how far out its own endDate
// goes. Without this, one override with a far-future endDate could make a
// listing bookable for a year+ straight, and whatever picks dates from
// getBookableDates (a dropdown, say) would have to render all of them.
export const MAX_OPEN_EXTENSION_DAYS = 90;

// Every calendar date this listing can be booked on. Base rule: today
// through Venue.bookingWindowDays, every day for time_range/date_range
// (both are assumed open daily, same as the rest of this schema), or only
// the matching weekday for fixed_session. An override then adjusts that:
// a block removes a date inside the window, an open adds one beyond it -
// beyond the window nothing is bookable unless something explicitly opens
// it, same as inside the window nothing is blocked unless something
// explicitly closes it. Nothing is ever bookable past MAX_OPEN_EXTENSION_DAYS,
// no matter what an override's own endDate says.
export async function getBookableDates(listing: AvailabilityListing): Promise<Date[]> {
  const today = todayInTimezone(listing.venue.city.timezone);
  const windowEnd = addDays(today, listing.venue.bookingWindowDays);
  const hardCap = addDays(today, MAX_OPEN_EXTENSION_DAYS);

  // Fetches every override that could still apply today or later, for
  // either this listing specifically or its venue as a whole.
  const overrides = await prisma.availabilityOverride.findMany({
    where: {
      AND: [
        { OR: [{ venueId: listing.venueId }, { listingId: listing.id }] },
        { OR: [{ endDate: null, startDate: { gte: today } }, { endDate: { gte: today } }] },
      ],
    },
  });

  // The loop needs to run past the normal window far enough to catch any
  // "open" override reaching beyond it - whichever end date is latest,
  // capped at hardCap so one override can't blow the loop out for a year.
  const loopEnd = overrides
    .filter((o) => o.kind === "open")
    .reduce((max, o) => {
      const end = o.endDate ?? o.startDate; // one-off rows often only set startDate
      return end > max ? end : max;
    }, windowEnd);
  const cappedLoopEnd = loopEnd < hardCap ? loopEnd : hardCap;

  // Runs before any override is even checked, so an "open" override can
  // never add a day outside a fixed_session listing's own weekday - a
  // one-off class on a different day needs its own Listing row instead.
  // There's no admin UI yet to create overrides at all, so nothing enforces
  // this on the way in - worth a validation rule once one exists.
  const matchesPattern = (date: Date) =>
    listing.activity.bookingMechanic !== "fixed_session" || date.getUTCDay() === listing.recurrenceDayOfWeek;

  // Same-day cut-off for date_range listings (see isSameDayBookingClosed).
  // Applied here, the one place that decides bookable days, so the
  // calendar, the browse date filter and the server's own check of a
  // submitted booking all agree without each re-implementing it. Courts
  // and classes don't need it: their pickers and isRequestedSlotValid
  // already reject start times that have passed, and a court booking must
  // end by closing time.
  const todayClosed =
    listing.activity.bookingMechanic === "date_range" &&
    isSameDayBookingClosed(listing.operatingHoursEnd, listing.venue.city.timezone);

  const dates: Date[] = [];
  for (let d = today; d <= cappedLoopEnd; d = addDays(d, 1)) {
    if (!matchesPattern(d)) continue;
    if (todayClosed && d.getTime() === today.getTime()) continue;
    const kind = resolveOverrideKind(d, overrides, listing.id);
    const available = d <= windowEnd ? kind !== "block" : kind === "open";
    if (available) dates.push(d);
  }
  return dates;
}

// Re-derives whether a submitted startsAt/endsAt is actually legal for
// this listing, given its bookable dates. The server action calls this
// itself rather than trusting whatever the client sent - the UI enforces
// these same rules, but only this check actually matters for security.
export function isRequestedSlotValid(
  listing: AvailabilityListing,
  startsAt: Date,
  endsAt: Date,
  bookableDates: Date[]
): boolean {
  if (endsAt <= startsAt) return false;
  const timeZone = listing.venue.city.timezone;

  // time_range and fixed_session have a real wall-clock start instant, so
  // a start time that has already passed must be rejected outright, not
  // just a day that's too early. date_range has no equivalent concept -
  // its "start" is a whole calendar day, not an instant - so "book
  // starting today" stays valid regardless of what time it currently is.
  if (listing.activity.bookingMechanic !== "date_range" && startsAt < new Date()) return false;

  // date_range slots are stored as plain calendar days (UTC midnight of the
  // picked day - see DateRangePicker), not real instants, so their day is
  // read straight off the UTC date. Viewing one through the venue's
  // timezone, as the other mechanics correctly do, shifted it to the
  // previous day at any venue behind UTC (UTC midnight on the 28th is 8pm
  // on the 27th in New York): "today" was rejected as already past, and
  // every other day was checked against the wrong date.
  const day =
    listing.activity.bookingMechanic === "date_range" ? startOfUTCDay(startsAt) : calendarDayInTimezone(startsAt, timeZone);
  const isBookableDay = bookableDates.some((d) => d.getTime() === day.getTime());
  if (!isBookableDay) return false;

  const durationMinutes = (endsAt.getTime() - startsAt.getTime()) / 60000;

  switch (listing.activity.bookingMechanic) {
    case "time_range": {
      if (calendarDayInTimezone(endsAt, timeZone).getTime() !== day.getTime()) return false; // no overnight bookings
      if (!listing.operatingHoursStart || !listing.operatingHoursEnd) return false;
      const startMinutes = minutesOfDayInTimezone(startsAt, timeZone);
      const endMinutes = minutesOfDayInTimezone(endsAt, timeZone);
      if (startMinutes < minutesSinceMidnight(listing.operatingHoursStart)) return false;
      if (endMinutes > minutesSinceMidnight(listing.operatingHoursEnd)) return false;
      if (listing.minDurationMinutes && durationMinutes < listing.minDurationMinutes) return false;
      if (listing.maxDurationMinutes && durationMinutes > listing.maxDurationMinutes) return false;
      if (listing.incrementMinutes && startMinutes % listing.incrementMinutes !== 0) return false;
      return true;
    }
    case "date_range": {
      const durationDays = durationMinutes / (60 * 24);
      if (listing.minDurationDays && durationDays < listing.minDurationDays) return false;
      if (listing.maxDurationDays && durationDays > listing.maxDurationDays) return false;
      return true;
    }
    case "fixed_session": {
      if (!listing.recurrenceStartTime || !listing.sessionDurationMinutes) return false;
      const expectedStartMinutes = minutesSinceMidnight(listing.recurrenceStartTime);
      const actualStartMinutes = minutesOfDayInTimezone(startsAt, timeZone);
      if (actualStartMinutes !== expectedStartMinutes) return false;
      return durationMinutes === listing.sessionDurationMinutes;
    }
  }
}

// Remaining capacity for each fixed_session occurrence, keyed by the
// occurrence's calendar date (ms epoch of its UTC midnight, same convention
// getBookableDates already returns its dates in) rather than its startsAt -
// that's what the picker actually has on hand for each button it renders.
// Grouping the booking query by exact startsAt (rather than the general
// overlap-range query createBookingHold's conflict check uses) is safe
// here specifically because isRequestedSlotValid's fixed_session branch
// above already guarantees every booking against this listing starts at
// exactly the recurrence time - a fixed_session booking can never
// partially overlap an occurrence the way a time_range one can. One query
// for every occurrence date, not one per date.
export async function getSpotsRemaining(
  listing: Pick<Listing, "id" | "capacity" | "recurrenceStartTime">,
  occurrenceDates: Date[],
  timeZone: string
): Promise<Map<number, number | null>> {
  if (listing.capacity === null || !listing.recurrenceStartTime || occurrenceDates.length === 0) {
    // Unlimited capacity, or no schedule configured at all - nothing to
    // subtract from, so every occurrence just reports "unlimited" (null).
    return new Map(occurrenceDates.map((d) => [d.getTime(), null]));
  }

  const startsByDate = occurrenceDates.map(
    (date) => [date, zonedOccurrenceStart(date, listing.recurrenceStartTime!, timeZone)] as const
  );
  const starts = startsByDate.map(([, start]) => start);

  // Sums already-claimed quantity per occurrence start time, from
  // confirmed bookings and from active (non-expired) holds alike - a
  // slot someone else is mid-checkout on shouldn't show as open here.
  const [bookedSums, heldSums] = await Promise.all([
    prisma.booking.groupBy({
      by: ["startsAt"],
      where: { listingId: listing.id, status: { not: "cancelled" }, startsAt: { in: starts } },
      _sum: { quantity: true },
    }),
    prisma.bookingHold.groupBy({
      by: ["startsAt"],
      where: { listingId: listing.id, expiresAt: { gt: new Date() }, startsAt: { in: starts } },
      _sum: { quantity: true },
    }),
  ]);
  const bookedByStart = new Map(bookedSums.map((row) => [row.startsAt.getTime(), row._sum.quantity ?? 0]));
  const heldByStart = new Map(heldSums.map((row) => [row.startsAt.getTime(), row._sum.quantity ?? 0]));

  return new Map(
    startsByDate.map(([date, start]) => [
      date.getTime(),
      listing.capacity! - (bookedByStart.get(start.getTime()) ?? 0) - (heldByStart.get(start.getTime()) ?? 0),
    ])
  );
}

// One existing Booking/BookingHold's occupied range on a single calendar
// date, in venue-local minutes-of-day - the same unit TimeRangePicker's own
// candidate start times are already expressed in, so the picker can
// compare them directly with no further conversion.
export type OccupiedInterval = { startMinutes: number; endMinutes: number; quantity: number };

// Per-date map of existing Bookings/BookingHolds' occupied ranges on a
// time_range listing, used by TimeRangePicker to disable a start time that
// would conflict - the picker's own equivalent of the overlap-sum check
// createBookingHold already enforces server-side (see that transaction's
// own comment), surfaced here for display instead of enforcement. A
// time_range booking/hold never spans more than one calendar day -
// isRequestedSlotValid's time_range branch rejects an overnight request -
// so every claim belongs to exactly one date's bucket.
export async function getOccupiedIntervals(
  listing: Pick<Listing, "id">,
  bookableDates: Date[],
  timeZone: string
): Promise<Map<number, OccupiedInterval[]>> {
  if (bookableDates.length === 0) return new Map();

  // Venue-LOCAL window boundaries spanning the whole bookable range, same
  // reasoning as hasAvailableSlotOnDate's own dayStart/dayEnd below - one
  // query covering every date beats one query per date.
  const windowStart = zonedOccurrenceStart(bookableDates[0], "00:00", timeZone);
  const windowEnd = zonedOccurrenceStart(addDays(bookableDates[bookableDates.length - 1], 1), "00:00", timeZone);

  const [bookings, holds] = await Promise.all([
    prisma.booking.findMany({
      where: {
        listingId: listing.id,
        status: { not: "cancelled" },
        startsAt: { lt: windowEnd },
        endsAt: { gt: windowStart },
      },
      select: { startsAt: true, endsAt: true, quantity: true },
    }),
    prisma.bookingHold.findMany({
      where: {
        listingId: listing.id,
        expiresAt: { gt: new Date() },
        startsAt: { lt: windowEnd },
        endsAt: { gt: windowStart },
      },
      select: { startsAt: true, endsAt: true, quantity: true },
    }),
  ]);

  const byDate = new Map<number, OccupiedInterval[]>();
  for (const claim of [...bookings, ...holds]) {
    const day = calendarDayInTimezone(claim.startsAt, timeZone).getTime();
    const interval: OccupiedInterval = {
      startMinutes: minutesOfDayInTimezone(claim.startsAt, timeZone),
      endMinutes: minutesOfDayInTimezone(claim.endsAt, timeZone),
      quantity: claim.quantity,
    };
    const existing = byDate.get(day);
    if (existing) existing.push(interval);
    else byDate.set(day, [interval]);
  }
  return byDate;
}

// Dates where a date_range listing's capacity is already fully claimed by
// existing Bookings/BookingHolds, used by DateRangePicker to exclude them
// from the calendar the same way an AvailabilityOverride block already is -
// just sourced from real reservations instead of a manually-entered
// override row. Skipped entirely (no dates ever excluded) when capacity is
// null (unlimited) - nothing to exhaust.
export async function getFullyBookedDates(
  listing: Pick<Listing, "id" | "capacity">,
  bookableDates: Date[]
): Promise<Date[]> {
  if (listing.capacity === null || bookableDates.length === 0) return [];

  // date_range's startsAt/endsAt are plain UTC-midnight calendar-day
  // boundaries (see DateRangePicker's own localDateToUTCDay conversion),
  // not venue-local wall-clock instants like time_range's - no timezone
  // conversion belongs here, unlike getOccupiedIntervals above.
  const windowStart = bookableDates[0];
  const windowEnd = addDays(bookableDates[bookableDates.length - 1], 1);

  const [bookings, holds] = await Promise.all([
    prisma.booking.findMany({
      where: {
        listingId: listing.id,
        status: { not: "cancelled" },
        startsAt: { lt: windowEnd },
        endsAt: { gt: windowStart },
      },
      select: { startsAt: true, endsAt: true, quantity: true },
    }),
    prisma.bookingHold.findMany({
      where: {
        listingId: listing.id,
        expiresAt: { gt: new Date() },
        startsAt: { lt: windowEnd },
        endsAt: { gt: windowStart },
      },
      select: { startsAt: true, endsAt: true, quantity: true },
    }),
  ]);
  const claims = [...bookings, ...holds];

  return bookableDates.filter((date) => {
    const dayEnd = addDays(date, 1);
    const used = claims
      .filter((c) => c.startsAt < dayEnd && c.endsAt > date)
      .reduce((sum, c) => sum + c.quantity, 0);
    return used >= listing.capacity!;
  });
}

// Whether a time_range listing has at least one free slot of its own
// minimum bookable duration (the smallest commitment a user could actually
// make) somewhere within operating hours on a given day. Used by the
// browse page's date filter: a court being "open" that day (per
// getBookableDates) isn't enough on its own if every increment is already
// booked out. Walks every increment-aligned candidate start time and
// checks it against the same overlap-sum logic createBookingHold's own
// conflict check uses, swept across one day's candidates instead of one
// proposed slot - stops at the first one that clears.
export async function hasAvailableSlotOnDate(
  listing: Pick<Listing, "id" | "capacity" | "operatingHoursStart" | "operatingHoursEnd" | "minDurationMinutes" | "incrementMinutes">,
  date: Date,
  timeZone: string
): Promise<boolean> {
  if (listing.capacity === null) return true; // unlimited - nothing to exhaust
  if (!listing.operatingHoursStart || !listing.operatingHoursEnd || !listing.minDurationMinutes || !listing.incrementMinutes) {
    return false;
  }
  // incrementMinutes is a nullable Int with no DB constraint forcing it
  // positive - a 0 or negative value would otherwise never advance
  // candidateStart below, hanging this request forever.
  if (listing.incrementMinutes <= 0) return false;

  // Venue-LOCAL day boundaries, not pure UTC ones - "today" at an LA venue
  // spans a different UTC range than "today" at a Sydney one.
  const dayStart = zonedOccurrenceStart(date, "00:00", timeZone);
  const dayEnd = zonedOccurrenceStart(addDays(date, 1), "00:00", timeZone);

  // Fetches every non-cancelled booking, plus every active hold, that
  // overlaps this calendar day - used below to compute remaining capacity
  // at each candidate slot. A hold counts the same as a booking here,
  // since it's reserving the same capacity while someone else checks out.
  const [bookings, holds] = await Promise.all([
    prisma.booking.findMany({
      where: {
        listingId: listing.id,
        status: { not: "cancelled" },
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
      },
      select: { startsAt: true, endsAt: true, quantity: true },
    }),
    prisma.bookingHold.findMany({
      where: {
        listingId: listing.id,
        expiresAt: { gt: new Date() },
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
      },
      select: { startsAt: true, endsAt: true, quantity: true },
    }),
  ]);
  const claims = [...bookings, ...holds];

  const openMinutes = minutesSinceMidnight(listing.operatingHoursStart);
  const closeMinutes = minutesSinceMidnight(listing.operatingHoursEnd);

  for (
    let candidateStart = openMinutes;
    candidateStart + listing.minDurationMinutes <= closeMinutes;
    candidateStart += listing.incrementMinutes
  ) {
    // Built directly via TZDate (not dayStart + ms offset) - adding plain
    // milliseconds to a venue-local midnight would silently land on the
    // wrong wall-clock time across a DST transition within the same day.
    const slotStart = new TZDate(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      Math.floor(candidateStart / 60),
      candidateStart % 60,
      0,
      timeZone
    );
    const slotEnd = new Date(slotStart.getTime() + listing.minDurationMinutes * 60000);
    const overlapping = claims
      .filter((c) => c.startsAt < slotEnd && c.endsAt > slotStart)
      .reduce((sum, c) => sum + c.quantity, 0);
    if (overlapping < listing.capacity) return true;
  }
  return false;
}
