import "server-only";
import { prisma } from "@/lib/prisma";
import { withPermission } from "@/lib/auth-guards";
import { can } from "@/lib/authz/permissions";
import { manageableVenuesWhere } from "@/lib/authz/policies";
import { addDays, formatBookingTime, todayInTimezone } from "@/lib/dates";
import { getBookingReference } from "@/lib/booking-reference";
import { formatLocation } from "@/lib/dashboard/venues";

type BookingMechanic = "time_range" | "date_range" | "fixed_session";

export type OverviewVenue = {
  id: string;
  name: string;
  // "Sydney, NSW, Australia" (the region is left out when a city has none).
  location: string;
  // Only filled in for admins, who see every owner's venues.
  ownerName: string | null;
  activeListings: number;
  upcomingBookings: number;
};

export type OverviewBooking = {
  id: string;
  reference: string;
  listingName: string;
  venueName: string;
  // Already formatted in the venue's own timezone (see formatBookingTime).
  when: string;
  attendeeName: string;
  quantity: number;
  // "pending": the card is authorized but the payment hasn't been captured
  // yet (see completeOrderPayment). Usually only for a moment.
  status: "pending" | "confirmed";
};

export type DashboardOverview = {
  showOwners: boolean;
  stats: { bookingsToday: number; bookingsNext7Days: number; revenueLast30Days: number };
  venues: OverviewVenue[];
  comingUp: OverviewBooking[];
};

const COMING_UP_LIMIT = 8;
const REVENUE_DAYS = 30;

// A calendar day as "yyyy-mm-dd" on a given timezone's wall clock. Strings
// in this format compare correctly with < and >, which keeps the day maths
// below simple.
function dayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

// The first and last calendar day a booking covers, at its venue. Courts
// and classes are real instants, read on the venue's clock. Passes and
// stays are stored as plain calendar days (UTC midnight, end exclusive -
// see formatBookingTime), so they're read in UTC. Either way the end is
// exclusive, so the last day is the one just before it.
function bookingDays(
  booking: { startsAt: Date; endsAt: Date },
  timeZone: string,
  mechanic: BookingMechanic
): { first: string; last: string } {
  const zone = mechanic === "date_range" ? "UTC" : timeZone;
  return { first: dayKey(booking.startsAt, zone), last: dayKey(new Date(booking.endsAt.getTime() - 1), zone) };
}

// Everything the overview page shows, for the venues this user may manage:
// their own as a venue owner, every venue as an admin. Counts are of
// booking orders, matching My Bookings, so a 3-day pass counts once.
// Cancelled bookings are left out everywhere.
export const getDashboardOverview = withPermission(
  "dashboard:access",
  async (session): Promise<DashboardOverview> => {
    const venueScope = manageableVenuesWhere(session.user);
    const showOwners = can(session.user, "venues:manage-all");
    if (!venueScope) {
      return { showOwners, stats: { bookingsToday: 0, bookingsNext7Days: 0, revenueLast30Days: 0 }, venues: [], comingUp: [] };
    }

    const now = new Date();
    const [venues, recentAndUpcoming, revenue] = await Promise.all([
      prisma.venue.findMany({
        where: venueScope,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          city: { select: { name: true, region: true, country: { select: { name: true } } } },
          owner: { select: { name: true, email: true } },
          _count: { select: { listings: { where: { archivedAt: null } } } },
        },
      }),
      // Every booking that hasn't finished yet. A day of slack on the cut-off
      // keeps today's passes and stays: they're stored as UTC-midnight days,
      // so at venues ahead of UTC they "end" partway through the venue's
      // own day. Which ones are really still upcoming is decided per venue
      // below. Bounded by how far ahead anyone can book (the booking
      // window), so this stays a modest set however much history builds up.
      prisma.booking.findMany({
        where: {
          status: { not: "cancelled" },
          endsAt: { gt: addDays(now, -1) },
          listing: { venue: venueScope },
        },
        orderBy: { startsAt: "asc" },
        select: {
          id: true,
          orderId: true,
          startsAt: true,
          endsAt: true,
          quantity: true,
          status: true,
          attendeeName: true,
          listing: {
            select: {
              name: true,
              venueId: true,
              venue: { select: { name: true, city: { select: { timezone: true } } } },
              activity: { select: { bookingMechanic: true, isAccommodation: true } },
            },
          },
        },
      }),
      // Money actually taken: confirmed bookings, by when they were paid.
      prisma.booking.aggregate({
        where: {
          status: "confirmed",
          createdAt: { gte: addDays(now, -REVENUE_DAYS) },
          listing: { venue: venueScope },
        },
        _sum: { amountPaid: true },
      }),
    ]);

    const todayOrders = new Set<string>();
    const next7DaysOrders = new Set<string>();
    const upcomingOrdersByVenue = new Map<string, Set<string>>();
    const comingUp: OverviewBooking[] = [];

    for (const booking of recentAndUpcoming) {
      const { listing } = booking;
      const timeZone = listing.venue.city.timezone;
      const mechanic = listing.activity.bookingMechanic;
      // "Today" is the venue's today, not the server's or the viewer's.
      const today = todayInTimezone(timeZone);
      const todayKey = dayKey(today, "UTC");
      const weekEndKey = dayKey(addDays(today, 6), "UTC");
      const days = bookingDays(booking, timeZone, mechanic);

      // Courts and classes are over once their end time passes; passes and
      // stays once their last day is behind the venue's today.
      const upcoming = mechanic === "date_range" ? days.last >= todayKey : booking.endsAt > now;
      if (!upcoming) continue;

      if (days.first <= todayKey && days.last >= todayKey) todayOrders.add(booking.orderId);
      if (days.first <= weekEndKey && days.last >= todayKey) next7DaysOrders.add(booking.orderId);

      const venueOrders = upcomingOrdersByVenue.get(listing.venueId) ?? new Set<string>();
      venueOrders.add(booking.orderId);
      upcomingOrdersByVenue.set(listing.venueId, venueOrders);

      if (comingUp.length < COMING_UP_LIMIT) {
        comingUp.push({
          id: booking.id,
          reference: getBookingReference(booking.orderId),
          listingName: listing.name,
          venueName: listing.venue.name,
          when: formatBookingTime(booking.startsAt, booking.endsAt, timeZone, listing.activity),
          attendeeName: booking.attendeeName,
          quantity: booking.quantity,
          status: booking.status === "pending" ? "pending" : "confirmed",
        });
      }
    }

    return {
      showOwners,
      stats: {
        bookingsToday: todayOrders.size,
        bookingsNext7Days: next7DaysOrders.size,
        revenueLast30Days: Number(revenue._sum.amountPaid ?? 0),
      },
      venues: venues.map((venue) => ({
        id: venue.id,
        name: venue.name,
        location: formatLocation(venue.city),
        ownerName: showOwners ? (venue.owner.name ?? venue.owner.email) : null,
        activeListings: venue._count.listings,
        upcomingBookings: upcomingOrdersByVenue.get(venue.id)?.size ?? 0,
      })),
      comingUp,
    };
  }
);
