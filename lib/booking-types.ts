// User-facing labels for Activity.bookingMechanic, shown in the sidebar's
// "Booking type" filter. Ids are plain string literals matching the
// BookingMechanic enum's values rather than importing the generated enum,
// since this file is also imported by Client Components and the full
// Prisma client cannot be bundled for the browser.
export const BOOKING_TYPES = [
  { id: "time_range", label: "Book a time" },
  { id: "date_range", label: "Multi-day" },
  { id: "fixed_session", label: "Classes" },
] as const;

export type BookingTypeId = (typeof BOOKING_TYPES)[number]["id"];

export function isBookingTypeId(value: string): value is BookingTypeId {
  return BOOKING_TYPES.some((type) => type.id === value);
}
