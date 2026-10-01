import type { Activity, AvailabilityOverride, Listing, Venue } from "../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { minutesSinceMidnight } from "@/lib/time-of-day";

type AvailabilityListing = Listing & {
  venue: Pick<Venue, "bookingWindowDays">;
  activity: Pick<Activity, "bookingMechanic">;
};

function startOfUTCDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

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
  const today = startOfUTCDay(new Date());
  const windowEnd = addDays(today, listing.venue.bookingWindowDays);
  const hardCap = addDays(today, MAX_OPEN_EXTENSION_DAYS);

  // fetch overrides. This query
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

  const dates: Date[] = [];
  for (let d = today; d <= cappedLoopEnd; d = addDays(d, 1)) {
    if (!matchesPattern(d)) continue;
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
  const day = startOfUTCDay(startsAt);
  const isBookableDay = bookableDates.some((d) => d.getTime() === day.getTime());
  if (!isBookableDay) return false;

  const durationMinutes = (endsAt.getTime() - startsAt.getTime()) / 60000;

  switch (listing.activity.bookingMechanic) {
    case "time_range": {
      if (startOfUTCDay(endsAt).getTime() !== day.getTime()) return false; // no overnight bookings
      if (!listing.operatingHoursStart || !listing.operatingHoursEnd) return false;
      const startMinutes = startsAt.getUTCHours() * 60 + startsAt.getUTCMinutes();
      const endMinutes = endsAt.getUTCHours() * 60 + endsAt.getUTCMinutes();
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
      const actualStartMinutes = startsAt.getUTCHours() * 60 + startsAt.getUTCMinutes();
      if (actualStartMinutes !== expectedStartMinutes) return false;
      return durationMinutes === listing.sessionDurationMinutes;
    }
  }
}
