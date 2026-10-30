import "server-only";
import { prisma } from "@/lib/prisma";
import { withPermission } from "@/lib/auth-guards";
import { can } from "@/lib/authz/permissions";
import { canManageListing, canManageVenue } from "@/lib/authz/policies";
import { formatPrice } from "@/components/browse/listing-card";
import { getScheduleLine } from "@/lib/listing-schedule";
import { formatLocation } from "@/lib/dashboard/venues";
import { isUpcomingBooking, upcomingQueryCutoff } from "@/lib/dashboard/booking-days";

export type VenueListingRow = {
  id: string;
  name: string;
  activityName: string;
  // Already formatted the way browse shows it: "$20/hr", "$45/night", "Free".
  price: string;
  // "Open 6:00 AM – 10:00 PM daily", "Every Monday, 6:00 PM", or null.
  schedule: string | null;
  upcomingBookings: number;
  archived: boolean;
};

export type VenuePageData = {
  id: string;
  name: string;
  description: string | null;
  address: string;
  location: string;
  timezone: string;
  bookingWindowDays: number;
  holdDurationMinutes: number;
  // Only filled in for admins, who see every owner's venues.
  ownerName: string | null;
  listings: VenueListingRow[];
  // How many listings are archived, whether or not they're being shown -
  // so the page can say "Show 3 archived" or hide the toggle when there are
  // none.
  archivedCount: number;
};

export type ArchiveListingResult = { ok: true } | { ok: false; error: string };

const LISTING_NOT_FOUND = "This listing doesn't exist, or it isn't one you manage.";

// One venue with its listings, for the venue page. null when the venue
// doesn't exist or this user may not manage it (the page shows not-found
// either way, so another owner's venue is never confirmed to exist).
// Archived listings are left out unless asked for.
export const getVenuePage = withPermission(
  "venues:manage",
  async (session, venueId: string, includeArchived: boolean): Promise<VenuePageData | null> => {
    if (typeof venueId !== "string" || venueId.length > 64) return null;
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      include: {
        city: { include: { country: true } },
        owner: { select: { name: true, email: true } },
      },
    });
    if (!venue || !canManageVenue(session.user, venue)) return null;

    const now = new Date();
    const [listings, archivedCount, bookings] = await Promise.all([
      prisma.listing.findMany({
        where: { venueId: venue.id, ...(includeArchived ? {} : { archivedAt: null }) },
        // Active listings first, then alphabetical within each group.
        orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { name: "asc" }],
        include: { activity: { select: { name: true, bookingMechanic: true, isAccommodation: true } } },
      }),
      prisma.listing.count({ where: { venueId: venue.id, archivedAt: { not: null } } }),
      // Bookings that may still be upcoming, for the per-listing counts
      // (isUpcomingBooking decides exactly).
      prisma.booking.findMany({
        where: { status: { not: "cancelled" }, endsAt: { gt: upcomingQueryCutoff(now) }, listing: { venueId: venue.id } },
        select: {
          orderId: true,
          listingId: true,
          startsAt: true,
          endsAt: true,
          listing: { select: { activity: { select: { bookingMechanic: true } } } },
        },
      }),
    ]);

    // Counted as orders, like everywhere else in the dashboard.
    const upcomingByListing = new Map<string, Set<string>>();
    for (const booking of bookings) {
      if (!isUpcomingBooking(booking, venue.city.timezone, booking.listing.activity.bookingMechanic, now)) continue;
      const orders = upcomingByListing.get(booking.listingId) ?? new Set<string>();
      orders.add(booking.orderId);
      upcomingByListing.set(booking.listingId, orders);
    }

    return {
      id: venue.id,
      name: venue.name,
      description: venue.description,
      address: venue.address,
      location: formatLocation(venue.city),
      timezone: venue.city.timezone,
      bookingWindowDays: venue.bookingWindowDays,
      holdDurationMinutes: venue.holdDurationMinutes,
      ownerName: can(session.user, "venues:manage-all") ? (venue.owner.name ?? venue.owner.email) : null,
      archivedCount,
      listings: listings.map((listing) => ({
        id: listing.id,
        name: listing.name,
        activityName: listing.activity.name,
        price: formatPrice(listing),
        schedule: getScheduleLine(listing),
        upcomingBookings: upcomingByListing.get(listing.id)?.size ?? 0,
        archived: listing.archivedAt !== null,
      })),
    };
  }
);

// Archives a listing (archived: true) or restores it (false). Archiving
// hides it from browse and from new bookings; it's how a listing is retired,
// since deleting would destroy its booking history (Booking.listing is
// onDelete: Restrict). Bookings already made stay valid either way. The
// ownership check runs on the stored listing before anything is written.
export const setListingArchived = withPermission(
  "venues:manage",
  async (session, listingId: string, archived: boolean): Promise<ArchiveListingResult> => {
    if (typeof listingId !== "string" || listingId.length > 64 || typeof archived !== "boolean") {
      return { ok: false, error: LISTING_NOT_FOUND };
    }
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, archivedAt: true, venue: { select: { ownerId: true } } },
    });
    if (!listing || !canManageListing(session.user, listing)) return { ok: false, error: LISTING_NOT_FOUND };

    // Already in the requested state (e.g. a double click, or two tabs):
    // nothing to change, and archiving again mustn't move the archive date.
    if ((listing.archivedAt !== null) === archived) return { ok: true };
    await prisma.listing.update({ where: { id: listing.id }, data: { archivedAt: archived ? new Date() : null } });
    return { ok: true };
  }
);
