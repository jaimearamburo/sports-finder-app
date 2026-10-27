// Short, human-friendly display code derived from an orderId (see its own
// comment on Booking.orderId in schema.prisma). Cosmetic only - the full
// orderId stays the real lookup key everywhere else (confirmation page
// route param, My Bookings query, DB column). Shared by the confirmation
// page and the My Bookings table so the two can never show a different
// reference for the same order.
export function getBookingReference(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}
