import { formatTimeOfDay } from "@/lib/time-of-day";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// The fields getScheduleLine reads, so both the listing page's record and the
// dashboard's work.
export type ScheduleFields = {
  operatingHoursStart: string | null;
  operatingHoursEnd: string | null;
  recurrenceDayOfWeek: number | null;
  recurrenceStartTime: string | null;
  activity: { bookingMechanic: "time_range" | "date_range" | "fixed_session"; isAccommodation: boolean };
};

// A listing's schedule in one line: opening hours for courts and passes, the
// check-in deadline for a stay (operatingHoursEnd), or a class's weekday and
// time. Shared by the listing page and the dashboard. null when no schedule is
// set.
export function getScheduleLine(listing: ScheduleFields): string | null {
  switch (listing.activity.bookingMechanic) {
    case "time_range":
      return listing.operatingHoursStart && listing.operatingHoursEnd
        ? `Daily ${formatTimeOfDay(listing.operatingHoursStart)} – ${formatTimeOfDay(listing.operatingHoursEnd)}`
        : null;
    case "date_range":
      if (!listing.operatingHoursEnd) return null;
      if (listing.activity.isAccommodation) return `Check-in until ${formatTimeOfDay(listing.operatingHoursEnd)}`;
      return listing.operatingHoursStart
        ? `Daily ${formatTimeOfDay(listing.operatingHoursStart)} – ${formatTimeOfDay(listing.operatingHoursEnd)}`
        : null;
    case "fixed_session":
      return listing.recurrenceDayOfWeek !== null && listing.recurrenceStartTime
        ? `Every ${DAY_NAMES[listing.recurrenceDayOfWeek]}, ${formatTimeOfDay(listing.recurrenceStartTime)}`
        : null;
  }
}
