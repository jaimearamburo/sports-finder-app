// Plain date-math helpers with no DB/server dependency, so both
// lib/availability.ts (server-side) and the slot picker components
// (client-side) can share the exact same calendar-day normalization
// instead of each defining their own copy.

import { TZDate } from "@date-fns/tz";

export function startOfUTCDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

// A calendar widget (react-day-picker, and the native Date constructor in
// general) builds a clicked day as LOCAL midnight. Every bookable-date list
// in this app (getBookableDates, AvailabilityOverride resolution) is built
// in UTC-day terms instead (Date.UTC(...) throughout), so a calendar's own
// selection has to be re-expressed with the same year/month/day numbers in
// UTC form before it can be compared against or stored alongside those.
export function localDateToUTCDay(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

// "Today," as seen on a wall clock in a given IANA timezone - not the
// server's own UTC day, and not the viewer's. A booking's real-world
// validity is about the venue's clock, not either party's location.
// TZDate.tz(timeZone) gives the current instant with its getters
// overridden to read that zone's local calendar/clock values, so
// localDateToUTCDay (built for exactly this "read local y/m/d, re-express
// as UTC midnight" conversion) applies unchanged.
export function todayInTimezone(timeZone: string): Date {
  return localDateToUTCDay(TZDate.tz(timeZone));
}

// The viewer's own local calendar day at midnight (plain Date, local
// timezone - not the UTC-midnight convention the functions above produce).
// Used to bound a date picker's own "no past dates" check at a point in
// the UI with no single venue to anchor "today" to (the browse grid spans
// many venues/timezones at once, so there's nothing more specific to use).
export function startOfLocalToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

// A booking's real-world date/time - shared by checkout, confirmation and
// My Bookings so all three describe the same booking identically.
//
// Courts and classes store real instants, so they're formatted in the
// venue's timezone: one date plus a start-end time.
//
// date_range bookings (stays, passes) store plain calendar days as UTC
// midnight, so they're formatted in UTC. Formatting them in the venue's
// timezone shifted every date a day early at venues behind UTC. Their end
// is exclusive (the day after the last booked day), which is shown as-is
// for a stay - it's the check-out date - but pulled back a day for a pass,
// so one pass day reads as a single date rather than "27 Oct - 28 Oct".
export function formatBookingTime(
  startsAt: Date,
  endsAt: Date,
  timeZone: string,
  kind: { bookingMechanic: "time_range" | "date_range" | "fixed_session"; isAccommodation: boolean }
): string {
  if (kind.bookingMechanic === "date_range") {
    const dayFormatter = new Intl.DateTimeFormat("en-AU", {
      timeZone: "UTC",
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const shownEnd = kind.isAccommodation ? endsAt : addDays(endsAt, -1);
    const start = dayFormatter.format(startsAt);
    const end = dayFormatter.format(shownEnd);
    return start === end ? start : `${start} - ${end}`;
  }

  const dateFormatter = new Intl.DateTimeFormat("en-AU", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeFormatter = new Intl.DateTimeFormat("en-AU", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  });

  const sameDay = dateFormatter.format(startsAt) === dateFormatter.format(endsAt);
  if (sameDay) {
    return `${dateFormatter.format(startsAt)}, ${timeFormatter.format(startsAt)} - ${timeFormatter.format(endsAt)}`;
  }
  return `${dateFormatter.format(startsAt)} - ${dateFormatter.format(endsAt)}`;
}
