import { minutesOf, type ParsedListing } from "@/lib/validation/listing";

// Whether a listing's upcoming bookings still fit after its settings change;
// shown as a warning before saving. Bookings are kept either way. No database
// access.

export type ImpactBooking = { orderId: string; startsAt: Date; endsAt: Date; quantity: number };

export type ListingImpact = {
  // Orders with at least one booking outside the new schedule or limits.
  ordersOutsideSchedule: number;
  // The most places booked at any one moment, when that's more than the new
  // capacity; null when capacity isn't exceeded (or is unlimited).
  peakOverCapacity: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Weekday (0 = Sunday) and minutes since midnight of an instant, on the
// venue's clock.
function localClock(date: Date, timeZone: string): { weekday: number; minutes: number; day: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { weekday, minutes: Number(parts.hour) * 60 + Number(parts.minute), day: `${parts.year}-${parts.month}-${parts.day}` };
}

// Whether a booking fits the listing's new settings, using the same checks as
// isRequestedSlotValid. Pass day counts are checked per order.
export function bookingFits(booking: ImpactBooking, listing: ParsedListing, timeZone: string): boolean {
  const durationMinutes = (booking.endsAt.getTime() - booking.startsAt.getTime()) / 60000;
  switch (listing.kind) {
    case "court": {
      const start = localClock(booking.startsAt, timeZone);
      const end = localClock(booking.endsAt, timeZone);
      if (start.day !== end.day && !(end.minutes === 0 && durationMinutes <= 24 * 60)) return false;
      const endMinutes = end.day === start.day ? end.minutes : 24 * 60;
      return (
        start.minutes >= minutesOf(listing.openingTime) &&
        endMinutes <= minutesOf(listing.closingTime) &&
        durationMinutes >= listing.minDurationMinutes &&
        durationMinutes <= listing.maxDurationMinutes &&
        start.minutes % listing.startStepMinutes === 0
      );
    }
    case "stay": {
      const nights = Math.round((booking.endsAt.getTime() - booking.startsAt.getTime()) / DAY_MS);
      return nights >= listing.minDays && nights <= listing.maxDays;
    }
    case "pass":
      return true;
    case "class": {
      const start = localClock(booking.startsAt, timeZone);
      return (
        start.weekday === listing.weekday &&
        start.minutes === minutesOf(listing.startTime) &&
        durationMinutes === listing.sessionMinutes
      );
    }
  }
}

// The most places booked at one moment. A sweep over start and end points; ends
// are processed first, so back-to-back bookings don't overlap.
export function peakConcurrentQuantity(bookings: ImpactBooking[]): number {
  const events = bookings.flatMap((booking) => [
    { at: booking.startsAt.getTime(), change: booking.quantity },
    { at: booking.endsAt.getTime(), change: -booking.quantity },
  ]);
  events.sort((a, b) => a.at - b.at || a.change - b.change);
  let current = 0;
  let peak = 0;
  for (const event of events) {
    current += event.change;
    peak = Math.max(peak, current);
  }
  return peak;
}

export function assessListingImpact(
  bookings: ImpactBooking[],
  listing: ParsedListing,
  timeZone: string
): ListingImpact {
  const outside = new Set<string>();
  for (const booking of bookings) {
    if (!bookingFits(booking, listing, timeZone)) outside.add(booking.orderId);
  }
  // A pass is one row per day, so its day count is per order.
  if (listing.kind === "pass") {
    const daysByOrder = new Map<string, number>();
    for (const booking of bookings) daysByOrder.set(booking.orderId, (daysByOrder.get(booking.orderId) ?? 0) + 1);
    for (const [orderId, days] of daysByOrder) {
      if (days < listing.minDays || days > listing.maxDays) outside.add(orderId);
    }
  }

  const peak = peakConcurrentQuantity(bookings);
  return {
    ordersOutsideSchedule: outside.size,
    peakOverCapacity: listing.capacity !== null && peak > listing.capacity ? peak : null,
  };
}
