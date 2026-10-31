import "server-only";
import { prisma } from "@/lib/prisma";
import { withPermission } from "@/lib/auth-guards";
import { can } from "@/lib/authz/permissions";
import { manageableVenuesWhere } from "@/lib/authz/policies";
import { addDays, formatBookingTime } from "@/lib/dates";
import { bookingDays, isUpcomingBooking, upcomingQueryCutoff, venueWeek } from "@/lib/dashboard/booking-days";
import { getBookingReference } from "@/lib/booking-reference";
import { formatLocation } from "@/lib/dashboard/venues";

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
  // "pending": card authorized, not yet captured (see completeOrderPayment).
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

// Everything the overview shows, for the venues this user may manage. Counts
// are orders (a 3-day pass counts once); cancelled bookings are excluded.
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
      // Bookings that haven't finished (isUpcomingBooking decides per venue).
      // Bounded by the booking window, so the set stays small.
      prisma.booking.findMany({
        where: {
          status: { not: "cancelled" },
          endsAt: { gt: upcomingQueryCutoff(now) },
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
      if (!isUpcomingBooking(booking, timeZone, mechanic, now)) continue;

      const { today, weekEnd } = venueWeek(timeZone);
      const days = bookingDays(booking, timeZone, mechanic);
      if (days.first <= today && days.last >= today) todayOrders.add(booking.orderId);
      if (days.first <= weekEnd && days.last >= today) next7DaysOrders.add(booking.orderId);

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
