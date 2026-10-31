// "HH:MM" strings (operating hours, recurrence start times) are venue
// wall-clock times, not timestamps.

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

// Adds minutes to an "HH:MM" time without going through a Date. Wraps past
// midnight.
export function addMinutesToTime(time: string, minutes: number): string {
  const total = minutesSinceMidnight(time) + minutes;
  const hour = Math.floor(total / 60) % 24;
  const minute = total % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// Combines a calendar day (UTC-midnight Date) with an "HH:MM" venue wall-clock
// time into a real instant. Shared by the pickers and the server-side queries
// so both build identical instants.
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
  // Returned as a plain Date: a TZDate passed to a Server Action arrives as a
  // plain object without Date methods.
  return new Date(zoned.getTime());
}

// The venue wall-clock minute of the day for an instant.
export function minutesOfDayInTimezone(instant: Date, timeZone: string): number {
  const zoned = new TZDate(instant, timeZone);
  return zoned.getHours() * 60 + zoned.getMinutes();
}

// The venue-local calendar day (UTC-midnight Date) for an instant. Use
// startOfUTCDay instead for values that are already calendar days.
export function calendarDayInTimezone(instant: Date, timeZone: string): Date {
  return localDateToUTCDay(new TZDate(instant, timeZone));
}

// Same-day booking of a pass or stay closes this long before closing time, so a
// pass bought at the cut-off still has time to be used.
export const SAME_DAY_CUTOFF_BUFFER_MINUTES = 60;

// Whether same-day booking has closed for a date_range listing, on the venue's
// clock. operatingHoursEnd is a pass's closing time or a campsite's check-in
// deadline. With no closing time, same-day booking is always closed. `now` is a
// parameter for tests.
export function isSameDayBookingClosed(operatingHoursEnd: string | null, timeZone: string, now: Date = new Date()): boolean {
  if (!operatingHoursEnd) return true;
  const cutoffMinutes = minutesSinceMidnight(operatingHoursEnd) - SAME_DAY_CUTOFF_BUFFER_MINUTES;
  return minutesOfDayInTimezone(now, timeZone) >= cutoffMinutes;
}

// Whether a minute of the day has already passed today on the venue's clock;
// used to disable past start times on today's date.
export function isPastToday(date: Date, minutesOfDay: number, timeZone: string): boolean {
  const today = todayInTimezone(timeZone);
  if (date.getTime() !== today.getTime()) return false;
  return minutesOfDay < minutesOfDayInTimezone(new Date(), timeZone);
}
