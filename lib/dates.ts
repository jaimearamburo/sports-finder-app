// Calendar-day helpers shared by server code and the pickers. A "day" is a Date
// at UTC midnight.

import { TZDate } from "@date-fns/tz";

export function startOfUTCDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

// Re-expresses a calendar widget's local-midnight Date as the same y/m/d at UTC
// midnight, the app's convention for a calendar day.
export function localDateToUTCDay(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

// Today on the venue's clock (UTC-midnight Date), not the server's or the
// viewer's.
export function todayInTimezone(timeZone: string): Date {
  return localDateToUTCDay(TZDate.tz(timeZone));
}

// The viewer's local midnight (a plain local Date). For date pickers with no
// single venue to anchor "today", e.g. the browse filter across many timezones.
export function startOfLocalToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

// A booking's date/time, shared by checkout, confirmation and My Bookings.
//
// Courts and classes are real instants, shown in the venue's timezone as one
// date plus a start-end time.
//
// Passes and stays are calendar days stored as UTC midnight, shown in UTC.
// Their end is exclusive: shown as-is for a stay (the check-out date), one day
// earlier for a pass, so a one-day pass shows a single date.
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
