// Short display code for an orderId, shared by the confirmation page and My
// Bookings. Display only; the full orderId is the lookup key everywhere.
export function getBookingReference(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}
