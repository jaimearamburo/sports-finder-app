// "HH:MM" strings (Listing.operatingHoursStart/End, recurrenceStartTime -
// see schema.prisma) are plain wall-clock time for the venue, not
// timestamps. No timezone conversion belongs here - just string parsing.

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
