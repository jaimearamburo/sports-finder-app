import "server-only";
import { prisma } from "@/lib/prisma";
import { withPermission } from "@/lib/auth-guards";
import { manageableVenuesWhere } from "@/lib/authz/policies";
import { addDays } from "@/lib/dates";
import { getBookingReference } from "@/lib/booking-reference";
import { bookingDays, isUpcomingBooking, upcomingQueryCutoff, type BookingMechanic } from "@/lib/dashboard/booking-days";
import { BOOKINGS_PAGE_SIZE, type BookingFilters } from "@/lib/validation/manager-bookings";
import type { Prisma } from "@/generated/prisma/client";

export type ManagerBookingSlot = { id: string; startsAt: Date; endsAt: Date; quantity: number };

// One order (all Booking rows sharing an orderId), the unit the bookings page
// lists.
export type ManagerBookingOrder = {
  orderId: string;
  reference: string;
  listingId: string;
  listingName: string;
  venueName: string;
  timeZone: string;
  bookingMechanic: BookingMechanic;
  isAccommodation: boolean;
  slots: ManagerBookingSlot[];
  quantity: number;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone: string | null;
  // The booking account's email when it isn't the attendee's; otherwise null.
  bookedByEmail: string | null;
  totalAmount: number;
  // "pending": the card is authorized but the capture hasn't settled.
  status: "pending" | "confirmed";
  upcoming: boolean;
  bookedAt: Date;
};

export type FilterVenueOption = { id: string; name: string; listings: { id: string; name: string; archived: boolean }[] };

export type ManagerBookingsPage = {
  orders: ManagerBookingOrder[];
  total: number;
  page: number;
  pageCount: number;
  // The filters actually applied: a venue or listing this user may not see (or
  // outside the chosen venue) is dropped.
  filters: BookingFilters;
  venues: FilterVenueOption[];
};

type CandidateRow = {
  orderId: string;
  startsAt: Date;
  endsAt: Date;
  listing: { activity: { bookingMechanic: BookingMechanic }; venue: { city: { timezone: string } } };
};

const CANDIDATE_SELECT = {
  orderId: true,
  startsAt: true,
  endsAt: true,
  listing: {
    select: {
      activity: { select: { bookingMechanic: true } },
      venue: { select: { city: { select: { timezone: true } } } },
    },
  },
} as const;

// Matches the booking reference (start of the order id) or the attendee's name
// or email.
function searchWhere(q: string | undefined): Prisma.BookingWhereInput {
  if (!q) return {};
  const conditions: Prisma.BookingWhereInput[] = [
    { attendeeName: { contains: q, mode: "insensitive" } },
    { attendeeEmail: { contains: q, mode: "insensitive" } },
  ];
  if (/^[0-9a-f-]+$/i.test(q)) conditions.push({ orderId: { startsWith: q.toLowerCase() } });
  return { OR: conditions };
}

// Orders at the venues this user manages (all venues for an admin), filtered
// and paged.
//
// "Upcoming" and date matching are decided per venue in code
// (lib/dashboard/booking-days.ts), since one query can't apply each venue's
// timezone. That runs over a bounded set (upcoming bookings are limited by the
// booking window, a date range by its length); the database pages the rest.
export const listManagerBookings = withPermission(
  "dashboard:access",
  async (session, requested: BookingFilters): Promise<ManagerBookingsPage> => {
    const scope = manageableVenuesWhere(session.user);
    const venueRows = scope
      ? await prisma.venue.findMany({
          where: scope,
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            listings: { orderBy: { name: "asc" }, select: { id: true, name: true, archivedAt: true } },
          },
        })
      : [];
    const venues: FilterVenueOption[] = venueRows.map((venue) => ({
      id: venue.id,
      name: venue.name,
      listings: venue.listings.map((listing) => ({ id: listing.id, name: listing.name, archived: listing.archivedAt !== null })),
    }));

    // Keep only filters naming something this user may see.
    const venue = venues.find((option) => option.id === requested.venue);
    const listingVenue = venues.find((option) => option.listings.some((listing) => listing.id === requested.listing));
    const listingId = listingVenue && (!venue || venue.id === listingVenue.id) ? requested.listing : undefined;
    const filters: BookingFilters = { ...requested, venue: venue?.id, listing: listingId };
    if (!scope) return { orders: [], total: 0, page: 1, pageCount: 1, filters, venues };

    const base: Prisma.BookingWhereInput = {
      status: { not: "cancelled" },
      listing: { venue: scope, ...(venue ? { venueId: venue.id } : {}) },
      ...(listingId ? { listingId } : {}),
      ...searchWhere(filters.q),
    };
    const now = new Date();

    // Orders with a booking on a day in the chosen range, on that venue's
    // calendar. The query adds a day of slack either side; bookingDays decides
    // exactly.
    let inDateRange: Set<string> | null = null;
    if (filters.from || filters.to) {
      const from = filters.from ?? "0000-01-01";
      const to = filters.to ?? "9999-12-31";
      const rows: CandidateRow[] = await prisma.booking.findMany({
        where: {
          ...base,
          ...(filters.to ? { startsAt: { lt: addDays(new Date(`${filters.to}T00:00:00Z`), 2) } } : {}),
          ...(filters.from ? { endsAt: { gt: addDays(new Date(`${filters.from}T00:00:00Z`), -1) } } : {}),
        },
        select: CANDIDATE_SELECT,
      });
      inDateRange = new Set(
        rows
          .filter((row) => {
            const days = bookingDays(row, row.listing.venue.city.timezone, row.listing.activity.bookingMechanic);
            return days.first <= to && days.last >= from;
          })
          .map((row) => row.orderId)
      );
    }
    const dateWhere: Prisma.BookingWhereInput = inDateRange ? { orderId: { in: [...inDateRange] } } : {};

    // Upcoming orders with each one's next start, for soonest-first ordering.
    const upcomingRows: CandidateRow[] = await prisma.booking.findMany({
      where: { ...base, ...dateWhere, endsAt: { gt: upcomingQueryCutoff(now) } },
      select: CANDIDATE_SELECT,
    });
    const nextStartByOrder = new Map<string, number>();
    for (const row of upcomingRows) {
      if (!isUpcomingBooking(row, row.listing.venue.city.timezone, row.listing.activity.bookingMechanic, now)) continue;
      const start = row.startsAt.getTime();
      nextStartByOrder.set(row.orderId, Math.min(start, nextStartByOrder.get(row.orderId) ?? start));
    }
    const upcomingIds = [...nextStartByOrder.keys()];

    let pageIds: string[];
    let total: number;
    const skip = (filters.page - 1) * BOOKINGS_PAGE_SIZE;
    if (filters.when === "upcoming") {
      const sorted = upcomingIds.sort((a, b) => nextStartByOrder.get(a)! - nextStartByOrder.get(b)!);
      total = sorted.length;
      pageIds = sorted.slice(skip, skip + BOOKINGS_PAGE_SIZE);
    } else {
      // Past: everything that isn't upcoming, most recent first. All: every
      // order, latest start first.
      const where: Prisma.BookingWhereInput = {
        AND: [base, dateWhere, filters.when === "past" ? { orderId: { notIn: upcomingIds } } : {}],
      };
      const [groups, pageGroups] = await Promise.all([
        prisma.booking.groupBy({ by: ["orderId"], where }),
        prisma.booking.groupBy({
          by: ["orderId"],
          where,
          _max: { startsAt: true },
          orderBy: [{ _max: { startsAt: "desc" } }, { orderId: "asc" }],
          skip,
          take: BOOKINGS_PAGE_SIZE,
        }),
      ]);
      total = groups.length;
      pageIds = pageGroups.map((group) => group.orderId);
    }

    const pageCount = Math.max(1, Math.ceil(total / BOOKINGS_PAGE_SIZE));
    if (pageIds.length === 0) return { orders: [], total, page: filters.page, pageCount, filters, venues };

    const rows = await prisma.booking.findMany({
      where: { orderId: { in: pageIds }, status: { not: "cancelled" } },
      orderBy: { startsAt: "asc" },
      include: {
        user: { select: { email: true } },
        listing: {
          select: {
            id: true,
            name: true,
            venue: { select: { name: true, city: { select: { timezone: true } } } },
            activity: { select: { bookingMechanic: true, isAccommodation: true } },
          },
        },
      },
    });
    const byOrder = new Map<string, typeof rows>();
    for (const row of rows) byOrder.set(row.orderId, [...(byOrder.get(row.orderId) ?? []), row]);

    const upcomingSet = new Set(upcomingIds);
    const orders = pageIds.flatMap((orderId): ManagerBookingOrder[] => {
      const orderRows = byOrder.get(orderId);
      if (!orderRows) return [];
      const first = orderRows[0];
      const bookedBy = first.user?.email ?? null;
      return [
        {
          orderId,
          reference: getBookingReference(orderId),
          listingId: first.listing.id,
          listingName: first.listing.name,
          venueName: first.listing.venue.name,
          timeZone: first.listing.venue.city.timezone,
          bookingMechanic: first.listing.activity.bookingMechanic,
          isAccommodation: first.listing.activity.isAccommodation,
          slots: orderRows.map((row) => ({ id: row.id, startsAt: row.startsAt, endsAt: row.endsAt, quantity: row.quantity })),
          quantity: first.quantity,
          attendeeName: first.attendeeName,
          attendeeEmail: first.attendeeEmail,
          attendeePhone: first.attendeePhone,
          bookedByEmail: bookedBy && bookedBy.toLowerCase() !== first.attendeeEmail.toLowerCase() ? bookedBy : null,
          totalAmount: orderRows.reduce((sum, row) => sum + Number(row.amountPaid ?? 0), 0),
          status: orderRows.every((row) => row.status === "confirmed") ? "confirmed" : "pending",
          upcoming: upcomingSet.has(orderId),
          bookedAt: first.createdAt,
        },
      ];
    });

    return { orders, total, page: filters.page, pageCount, filters, venues };
  }
);
