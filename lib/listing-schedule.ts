import { formatTimeOfDay } from "@/lib/time-of-day";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Just the fields getScheduleLine reads, so any listing-shaped data works:
// the public listing page's full record and the dashboard's smaller one.
export type ScheduleFields = {
  operatingHoursStart: string | null;
  operatingHoursEnd: string | null;
  recurrenceDayOfWeek: number | null;
  recurrenceStartTime: string | null;
  activity: { bookingMechanic: "time_range" | "date_range" | "fixed_session"; isAccommodation: boolean };
};

// A listing's schedule in one line: opening hours for courts and passes,
// the check-in deadline for a stay (operatingHoursEnd doubles as that -
// see isSameDayBookingClosed), and the day and time a class recurs on.
// Shared by the public listing page and the venue dashboard, so both
// describe a listing the same way. null when the listing has no schedule
// set.
export function getScheduleLine(listing: ScheduleFields): string | null {
  switch (listing.activity.bookingMechanic) {
    case "time_range":
      return listing.operatingHoursStart && listing.operatingHoursEnd
        ? `Open ${formatTimeOfDay(listing.operatingHoursStart)} – ${formatTimeOfDay(listing.operatingHoursEnd)} daily`
        : null;
    case "date_range":
      if (!listing.operatingHoursEnd) return null;
      if (listing.activity.isAccommodation) return `Check-in until ${formatTimeOfDay(listing.operatingHoursEnd)}`;
      return listing.operatingHoursStart
        ? `Open ${formatTimeOfDay(listing.operatingHoursStart)} – ${formatTimeOfDay(listing.operatingHoursEnd)} daily`
        : null;
    case "fixed_session":
      return listing.recurrenceDayOfWeek !== null && listing.recurrenceStartTime
        ? `Every ${DAY_NAMES[listing.recurrenceDayOfWeek]}, ${formatTimeOfDay(listing.recurrenceStartTime)}`
        : null;
  }
}
