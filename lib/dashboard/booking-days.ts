import { addDays, todayInTimezone } from "@/lib/dates";

// Calendar-day maths for booking counts in the dashboard, shared by the
// overview and the venue page so "today" and "upcoming" mean the same
// thing everywhere. Plain functions with no database access, so they're
// unit-tested directly.

export type BookingMechanic = "time_range" | "date_range" | "fixed_session";

// A calendar day as "yyyy-mm-dd" on a given timezone's wall clock. Strings
// in this format compare correctly with < and >.
export function dayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

// The first and last calendar day a booking covers, at its venue. Courts
// and classes are real instants, read on the venue's clock. Passes and
// stays are stored as plain calendar days (UTC midnight, end exclusive -
// see formatBookingTime), so they're read in UTC. Either way the end is
// exclusive, so the last day is the one just before it.
export function bookingDays(
  booking: { startsAt: Date; endsAt: Date },
  timeZone: string,
  mechanic: BookingMechanic
): { first: string; last: string } {
  const zone = mechanic === "date_range" ? "UTC" : timeZone;
  return { first: dayKey(booking.startsAt, zone), last: dayKey(new Date(booking.endsAt.getTime() - 1), zone) };
}

// The venue's today and the last day of its coming week, as day keys.
// "Today" is the venue's, not the server's or the viewer's.
export function venueWeek(timeZone: string): { today: string; weekEnd: string } {
  const today = todayInTimezone(timeZone);
  return { today: dayKey(today, "UTC"), weekEnd: dayKey(addDays(today, 6), "UTC") };
}

// Whether a booking hasn't finished yet. Courts and classes are over once
// their end time passes; passes and stays once their last day is behind
// the venue's today (they're stored as UTC-midnight days, so at venues
// ahead of UTC their stored end falls partway through the venue's own day).
export function isUpcomingBooking(
  booking: { startsAt: Date; endsAt: Date },
  timeZone: string,
  mechanic: BookingMechanic,
  now: Date
): boolean {
  if (mechanic !== "date_range") return booking.endsAt > now;
  return bookingDays(booking, timeZone, mechanic).last >= venueWeek(timeZone).today;
}

// The earliest end time a query needs to fetch to find every upcoming
// booking: a day of slack covers today's passes and stays at venues ahead
// of UTC (see isUpcomingBooking), which then decides exactly.
export function upcomingQueryCutoff(now: Date): Date {
  return addDays(now, -1);
}
