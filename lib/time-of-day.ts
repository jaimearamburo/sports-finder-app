// "HH:MM" strings (Listing.operatingHoursStart/End, recurrenceStartTime -
// see schema.prisma) are plain wall-clock time for the venue, not
// timestamps. No timezone conversion belongs here - just string parsing.

import { TZDate } from "@date-fns/tz";
import { localDateToUTCDay, todayInTimezone } from "@/lib/dates";

export function formatTimeOfDay(time: string): string {
  const [hourStr, minute] = time.split(":");
  const hour = Number(hourStr);
  const period = hour < 12 ? "AM" : "PM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute} ${period}`;
}

export function minutesSinceMidnight(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

// Combines a calendar day with a recurring "HH:MM" wall-clock time into one
// concrete UTC instant. Used both by FixedSessionPicker (building the
// startsAt it submits) and getSpotsRemaining (building the same instants
// server-side to query existing bookings against) - sharing this keeps the
// two from ever drifting apart on how that combination is computed.
// "HH:MM" wall-clock arithmetic for deriving a session's end time from its
// start time + duration, without going through a Date (and the timezone
// questions that would raise) - mirrors how operatingHoursStart/End and
// recurrenceStartTime are already plain strings, not Dates, throughout this
// schema. Wraps past midnight via %24 rather than overflowing into "25:30",
// though no seeded session actually crosses midnight today.
export function addMinutesToTime(time: string, minutes: number): string {
  const total = minutesSinceMidnight(time) + minutes;
  const hour = Math.floor(total / 60) % 24;
  const minute = total % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// Combines a calendar day (a UTC-midnight Date, this app's convention for
// "just a date, no time") with a recurring "HH:MM" wall-clock time,
// interpreted in the venue's own timezone, into one concrete instant.
// Building this through Date.UTC(...) directly would silently treat
// "HH:MM" as UTC time instead of venue-local time. Used by
// FixedSessionPicker/TimeRangePicker to build the startsAt they submit,
// and by getSpotsRemaining/hasAvailableSlotOnDate to build the same
// instants server-side when querying existing bookings, so both sides
// compute it identically.
export function zonedOccurrenceStart(date: Date, time: string, timeZone: string): Date {
  const minutes = minutesSinceMidnight(time);
  const zoned = new TZDate(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    Math.floor(minutes / 60),
    minutes % 60,
    0,
    timeZone
  );
  // Converted to a plain Date - a TZDate instance passed as a Server
  // Action argument (see TimeRangePicker/FixedSessionPicker, which build
  // startsAt from this and submit it to createBookingHoldAction) isn't
  // recognized as a real Date by that serialization boundary and arrives
  // server-side as a stripped object with no prototype methods at all.
  // Nothing downstream needs TZDate's extra timezone-aware behavior once
  // the correct UTC instant has already been computed.
  return new Date(zoned.getTime());
}

// The inverse direction: given a real instant (e.g. a submitted startsAt)
// and the venue's timezone, what wall-clock minute-of-day does it fall on
// there? Reading instant.getUTCHours()/getUTCMinutes() directly would only
// give the right answer when the venue's timezone happens to equal UTC.
export function minutesOfDayInTimezone(instant: Date, timeZone: string): number {
  const zoned = new TZDate(instant, timeZone);
  return zoned.getHours() * 60 + zoned.getMinutes();
}

// Same idea as minutesOfDayInTimezone, but for "which calendar day" rather
// than "which minute" - e.g. deciding whether a submitted startsAt's day
// is actually in bookableDates, or whether endsAt fell on a different
// venue-local day (an overnight booking). Use this for any value that is
// a real instant needing to be viewed through the venue's zone; use
// startOfUTCDay instead for a value that is already a pure calendar day
// (like bookableDates' own entries, or an AvailabilityOverride's
// startDate).
export function calendarDayInTimezone(instant: Date, timeZone: string): Date {
  return localDateToUTCDay(new TZDate(instant, timeZone));
}

// Whether a given minute-of-day on a given calendar date has already
// passed, as seen from the venue's own clock - used to disable picking a
// start time earlier than right now on today's date. Any date before
// today is never actually passed in here in practice, since callers
// filter to bookableDates first, which already excludes earlier days.
export function isPastToday(date: Date, minutesOfDay: number, timeZone: string): boolean {
  const today = todayInTimezone(timeZone);
  if (date.getTime() !== today.getTime()) return false;
  return minutesOfDay < minutesOfDayInTimezone(new Date(), timeZone);
}
