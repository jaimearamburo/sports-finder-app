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
  // Every date/time calculation here uses the venue's timezone, not the
  // server's or the viewer's.
  venue: Pick<Venue, "bookingWindowDays"> & { city: Pick<City, "timezone"> };
  activity: Pick<Activity, "bookingMechanic">;
};

// Whether an override applies on a date. Without an endDate it covers startDate
// only, whether or not daysOfWeek is set; daysOfWeek only applies within a
// startDate-endDate range.
function overrideAppliesOn(override: AvailabilityOverride, date: Date): boolean {
  if (date < override.startDate) return false;
  if (!override.endDate) return date.getTime() === override.startDate.getTime();
  if (date > override.endDate) return false;
  return override.daysOfWeek.length === 0 || override.daysOfWeek.includes(date.getUTCDay());
}

// A listing-level override beats a venue-level one on the same date.
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

// How far past today an "open" override can extend bookability, whatever its
// own endDate says.
export const MAX_OPEN_EXTENSION_DAYS = 90;

// Every calendar date this listing can be booked on (UTC-midnight Dates).
//
// Base rule: today through Venue.bookingWindowDays, every day for
// time_range/date_range, only the matching weekday for fixed_session. Inside
// the window a date is available unless blocked; beyond it, unavailable unless
// opened. Nothing past MAX_OPEN_EXTENSION_DAYS.
export async function getBookableDates(listing: AvailabilityListing): Promise<Date[]> {
  const today = todayInTimezone(listing.venue.city.timezone);
  const windowEnd = addDays(today, listing.venue.bookingWindowDays);
  const hardCap = addDays(today, MAX_OPEN_EXTENSION_DAYS);

  // Overrides for this listing or its venue that can still apply today or
  // later.
  const overrides = await prisma.availabilityOverride.findMany({
    where: {
      AND: [
        { OR: [{ venueId: listing.venueId }, { listingId: listing.id }] },
        { OR: [{ endDate: null, startDate: { gte: today } }, { endDate: { gte: today } }] },
      ],
    },
  });

  // Extend the loop to the latest "open" override, capped at
  // MAX_OPEN_EXTENSION_DAYS.
  const loopEnd = overrides
    .filter((o) => o.kind === "open")
    .reduce((max, o) => {
      const end = o.endDate ?? o.startDate; // one-off overrides often set only startDate
      return end > max ? end : max;
    }, windowEnd);
  const cappedLoopEnd = loopEnd < hardCap ? loopEnd : hardCap;

  // Checked before overrides, so an "open" override can't add a day outside a
  // class's own weekday; a one-off class on another day needs its own Listing.
  const matchesPattern = (date: Date) =>
    listing.activity.bookingMechanic !== "fixed_session" || date.getUTCDay() === listing.recurrenceDayOfWeek;

  // Same-day cut-off for date_range listings (see isSameDayBookingClosed).
  // Applied here so the calendar, the browse date filter and the server's
  // booking check all agree. Courts and classes already reject start times that
  // have passed.
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

// Whether a submitted startsAt/endsAt is legal for this listing, given its
// bookable dates. The server's real check; the pickers enforce the same rules
// only as UX.
export function isRequestedSlotValid(
  listing: AvailabilityListing,
  startsAt: Date,
  endsAt: Date,
  bookableDates: Date[]
): boolean {
  if (endsAt <= startsAt) return false;
  const timeZone = listing.venue.city.timezone;

  // Courts and classes have real start instants, so a start in the past is
  // rejected. A date_range start is a whole calendar day, so today stays valid
  // all day (until the same-day cut-off).
  if (listing.activity.bookingMechanic !== "date_range" && startsAt < new Date()) return false;

  // date_range slots are calendar days stored as UTC midnight, so their day is
  // read in UTC. Courts and classes are real instants, read in the venue's
  // timezone.
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

// Remaining capacity per class occurrence, keyed by the occurrence's calendar
// date (UTC-midnight ms, like getBookableDates). Grouping bookings by exact
// startsAt is safe because isRequestedSlotValid only accepts starts at the
// recurrence time. One query for all dates.
export async function getSpotsRemaining(
  listing: Pick<Listing, "id" | "capacity" | "recurrenceStartTime">,
  occurrenceDates: Date[],
  timeZone: string
): Promise<Map<number, number | null>> {
  if (listing.capacity === null || !listing.recurrenceStartTime || occurrenceDates.length === 0) {
    // Unlimited capacity or no schedule: every occurrence reports null
    // (unlimited).
    return new Map(occurrenceDates.map((d) => [d.getTime(), null]));
  }

  const startsByDate = occurrenceDates.map(
    (date) => [date, zonedOccurrenceStart(date, listing.recurrenceStartTime!, timeZone)] as const
  );
  const starts = startsByDate.map(([, start]) => start);

  // Claimed quantity per occurrence from non-cancelled bookings and unexpired
  // holds.
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

// One booking or hold's occupied range on one date, in venue-local minutes of
// the day (the unit TimeRangePicker uses).
export type OccupiedInterval = { startMinutes: number; endMinutes: number; quantity: number };

// Occupied ranges per date on a court, so TimeRangePicker can disable
// conflicting start times. Display only; createBookingHold enforces capacity.
// Court bookings never span midnight, so each belongs to one date.
export async function getOccupiedIntervals(
  listing: Pick<Listing, "id">,
  bookableDates: Date[],
  timeZone: string
): Promise<Map<number, OccupiedInterval[]>> {
  if (bookableDates.length === 0) return new Map();

  // Venue-local boundaries across the whole bookable range: one query instead
  // of one per date.
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

// Dates where a date_range listing's capacity is fully claimed by bookings and
// holds, so DateRangePicker can exclude them. Always empty for unlimited
// capacity.
export async function getFullyBookedDates(
  listing: Pick<Listing, "id" | "capacity">,
  bookableDates: Date[]
): Promise<Date[]> {
  if (listing.capacity === null || bookableDates.length === 0) return [];

  // date_range slots are UTC-midnight calendar days, so no timezone conversion
  // is needed here.
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

// Whether a court has at least one free slot of its minimum length within
// opening hours on a date. Used by the browse date filter: being open that day
// isn't enough if every slot is booked. Walks step-aligned start times and
// stops at the first free one.
export async function hasAvailableSlotOnDate(
  listing: Pick<Listing, "id" | "capacity" | "operatingHoursStart" | "operatingHoursEnd" | "minDurationMinutes" | "incrementMinutes">,
  date: Date,
  timeZone: string
): Promise<boolean> {
  if (listing.capacity === null) return true; // unlimited - nothing to exhaust
  if (!listing.operatingHoursStart || !listing.operatingHoursEnd || !listing.minDurationMinutes || !listing.incrementMinutes) {
    return false;
  }
  // Guards against a non-positive step, which would loop forever.
  if (listing.incrementMinutes <= 0) return false;

  // Venue-local day boundaries.
  const dayStart = zonedOccurrenceStart(date, "00:00", timeZone);
  const dayEnd = zonedOccurrenceStart(addDays(date, 1), "00:00", timeZone);

  // Bookings and unexpired holds overlapping this day.
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
    // Built with TZDate rather than midnight plus an offset, so the wall-clock
    // time stays correct across a DST change.
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
