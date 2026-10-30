import "server-only";
import { prisma } from "@/lib/prisma";
import { withPermission } from "@/lib/auth-guards";
import { can } from "@/lib/authz/permissions";
import { canManageListing, canManageVenue } from "@/lib/authz/policies";
import { formatPrice } from "@/components/browse/listing-card";
import { getScheduleLine } from "@/lib/listing-schedule";
import { formatLocation } from "@/lib/dashboard/venues";
import { isUpcomingBooking, upcomingQueryCutoff } from "@/lib/dashboard/booking-days";
import { assessListingImpact, type ListingImpact } from "@/lib/dashboard/listing-impact";
import { checkVenueImageUrl, deleteReplacedListingImage } from "@/lib/dashboard/listing-images";
import {
  listingKindFor,
  NEW_LISTING_DEFAULTS,
  parseListing,
  type ListingFieldErrors,
  type ListingFormInput,
  type ListingKind,
  type ParsedListing,
} from "@/lib/validation/listing";
import type { Prisma } from "@/generated/prisma/client";

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

// --- Creating and editing listings ---------------------------------------

export type ActivityOption = {
  id: string;
  name: string;
  kind: ListingKind;
  // The activity's primary tag (see getPrimaryTag), for the preview card's
  // colour and emoji. null for an untagged activity.
  tag: { emoji: string; color: string } | null;
};

// The venue a listing belongs to, as the editor shows it (and as the
// preview card needs it).
export type ListingEditorVenue = { id: string; name: string; cityName: string; countryName: string; timezone: string };

export type ListingEditorData = {
  venue: ListingEditorVenue;
  listing: { id: string; archived: boolean; activity: ActivityOption; values: ListingFormInput } | null;
};

export type SaveListingResult =
  | { ok: true; listingId: string; venueId: string }
  | { ok: false; error?: string; fieldErrors?: ListingFieldErrors; impact?: ListingImpact };

const VENUE_NOT_FOUND = "This venue doesn't exist, or it isn't one you manage.";

function toActivityOption(activity: {
  id: string;
  name: string;
  bookingMechanic: "time_range" | "date_range" | "fixed_session";
  isAccommodation: boolean;
  tags: { tag: { emoji: string; color: string } }[];
}): ActivityOption {
  const tag = activity.tags[0]?.tag;
  return { id: activity.id, name: activity.name, kind: listingKindFor(activity), tag: tag ? { emoji: tag.emoji, color: tag.color } : null };
}

const ACTIVITY_SELECT = {
  id: true,
  name: true,
  bookingMechanic: true,
  isAccommodation: true,
  // The same "first tag" the browse card uses for its colour.
  tags: { select: { tag: { select: { emoji: true, color: true } } }, take: 1 },
} as const;

// Every activity a listing can be, for the new-listing form. Platform data,
// the same for everyone.
export async function getActivityOptions(): Promise<ActivityOption[]> {
  const activities = await prisma.activity.findMany({ orderBy: { name: "asc" }, select: ACTIVITY_SELECT });
  return activities.map(toActivityOption);
}

function toEditorVenue(venue: { id: string; name: string; city: { name: string; timezone: string; country: { name: string } } }): ListingEditorVenue {
  return { id: venue.id, name: venue.name, cityName: venue.city.name, countryName: venue.city.country.name, timezone: venue.city.timezone };
}

const VENUE_SELECT = {
  id: true,
  name: true,
  ownerId: true,
  city: { select: { name: true, timezone: true, country: { select: { name: true } } } },
} as const;

// A stored listing as form values. Fields its kind doesn't use get the
// usual defaults, so switching what's shown never meets an empty value.
function toFormValues(listing: Prisma.ListingGetPayload<{ include: { activity: true } }>): ListingFormInput {
  const d = NEW_LISTING_DEFAULTS;
  return {
    activityId: listing.activityId,
    name: listing.name,
    description: listing.description ?? "",
    imageUrl: listing.imageUrl,
    price: Number(listing.pricePerUnit),
    capacity: listing.capacity,
    maxPerBooking: listing.maxBookingsPerTransaction ?? 1,
    openingTime: listing.operatingHoursStart ?? d.openingTime,
    closingTime: listing.operatingHoursEnd ?? d.closingTime,
    startStepMinutes: listing.incrementMinutes ?? d.startStepMinutes,
    minDurationMinutes: listing.minDurationMinutes ?? d.minDurationMinutes,
    maxDurationMinutes: listing.maxDurationMinutes ?? d.maxDurationMinutes,
    minDays: listing.minDurationDays ?? d.minDays,
    maxDays: listing.maxDurationDays ?? d.maxDays,
    weekday: listing.recurrenceDayOfWeek ?? d.weekday,
    startTime: listing.recurrenceStartTime ?? d.startTime,
    sessionMinutes: listing.sessionDurationMinutes ?? d.sessionMinutes,
  };
}

// Parsed values as database columns. Columns the listing's kind doesn't use
// are cleared, so a listing never carries stale settings from another kind
// that some code might one day read. holdDurationMinutes (a per-listing
// override of the venue's hold time) isn't part of the form and is left
// as it is.
function toListingColumns(parsed: ParsedListing) {
  const cleared = {
    operatingHoursStart: null,
    operatingHoursEnd: null,
    minDurationMinutes: null,
    maxDurationMinutes: null,
    incrementMinutes: null,
    minDurationDays: null,
    maxDurationDays: null,
    recurrenceDayOfWeek: null,
    recurrenceStartTime: null,
    sessionDurationMinutes: null,
  };
  const shared = {
    name: parsed.name,
    description: parsed.description,
    imageUrl: parsed.imageUrl,
    pricePerUnit: parsed.price,
    capacity: parsed.capacity,
    // Only meaningful when one booking can take several places; otherwise
    // the quantity picker isn't shown and 1 is the truth.
    maxBookingsPerTransaction: parsed.capacity === 1 ? 1 : parsed.maxPerBooking,
  };
  switch (parsed.kind) {
    case "court":
      return {
        ...shared,
        ...cleared,
        operatingHoursStart: parsed.openingTime,
        operatingHoursEnd: parsed.closingTime,
        incrementMinutes: parsed.startStepMinutes,
        minDurationMinutes: parsed.minDurationMinutes,
        maxDurationMinutes: parsed.maxDurationMinutes,
      };
    case "pass":
      return {
        ...shared,
        ...cleared,
        operatingHoursStart: parsed.openingTime,
        operatingHoursEnd: parsed.closingTime,
        minDurationDays: parsed.minDays,
        maxDurationDays: parsed.maxDays,
      };
    case "stay":
      return { ...shared, ...cleared, operatingHoursEnd: parsed.closingTime, minDurationDays: parsed.minDays, maxDurationDays: parsed.maxDays };
    case "class":
      return {
        ...shared,
        ...cleared,
        recurrenceDayOfWeek: parsed.weekday,
        recurrenceStartTime: parsed.startTime,
        sessionDurationMinutes: parsed.sessionMinutes,
      };
  }
}

// The columns that decide which bookings fit a listing. Only a change to
// one of these can leave an upcoming booking outside the rules, so they're
// what the schedule-change warning compares.
const BOOKING_RULE_SELECT = {
  capacity: true,
  operatingHoursStart: true,
  operatingHoursEnd: true,
  incrementMinutes: true,
  minDurationMinutes: true,
  maxDurationMinutes: true,
  minDurationDays: true,
  maxDurationDays: true,
  recurrenceDayOfWeek: true,
  recurrenceStartTime: true,
  sessionDurationMinutes: true,
} as const;
const BOOKING_RULE_COLUMNS = Object.keys(BOOKING_RULE_SELECT) as (keyof typeof BOOKING_RULE_SELECT)[];

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 64;
}

// The venue a new listing will be added to, or null when it doesn't exist
// or this user may not manage it.
export const getNewListingVenue = withPermission(
  "venues:manage",
  async (session, venueId: string): Promise<ListingEditorVenue | null> => {
    if (!isId(venueId)) return null;
    const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: VENUE_SELECT });
    if (!venue || !canManageVenue(session.user, venue)) return null;
    return toEditorVenue(venue);
  }
);

// A listing and its venue for the edit form, or null when it doesn't exist
// or this user may not manage it.
export const getListingEditor = withPermission(
  "venues:manage",
  async (session, listingId: string): Promise<ListingEditorData | null> => {
    if (!isId(listingId)) return null;
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: { activity: { include: { tags: { include: { tag: true }, take: 1 } } }, venue: { select: VENUE_SELECT } },
    });
    if (!listing || !canManageListing(session.user, listing)) return null;
    return {
      venue: toEditorVenue(listing.venue),
      listing: {
        id: listing.id,
        archived: listing.archivedAt !== null,
        activity: toActivityOption(listing.activity),
        values: toFormValues(listing),
      },
    };
  }
);

// A new listing at a venue this user may manage. Which rules apply comes
// from the chosen activity, looked up here rather than trusted from the
// form.
export const createListing = withPermission(
  "venues:manage",
  async (session, venueId: string, input: ListingFormInput): Promise<SaveListingResult> => {
    if (!isId(venueId)) return { ok: false, error: VENUE_NOT_FOUND };
    const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true, ownerId: true } });
    if (!venue || !canManageVenue(session.user, venue)) return { ok: false, error: VENUE_NOT_FOUND };

    const activity = isId(input?.activityId)
      ? await prisma.activity.findUnique({ where: { id: input.activityId }, select: { id: true, bookingMechanic: true, isAccommodation: true } })
      : null;
    if (!activity) return { ok: false, fieldErrors: { activityId: "Choose an activity from the list." } };

    const parsed = parseListing(listingKindFor(activity), input);
    if (!parsed.ok) return parsed;
    if (parsed.data.imageUrl) {
      const imageError = await checkVenueImageUrl(parsed.data.imageUrl, venue.id);
      if (imageError) return { ok: false, fieldErrors: { imageUrl: imageError } };
    }
    const listing = await prisma.listing.create({
      data: { ...toListingColumns(parsed.data), venueId: venue.id, activityId: activity.id },
      select: { id: true },
    });
    return { ok: true, listingId: listing.id, venueId: venue.id };
  }
);

// Saves changes to a listing this user may manage. The activity can't
// change (a court can't become a class - its bookings were made under the
// court's rules), so the stored one is used whatever the form sends.
//
// A new or removed photo replaces the stored one; the old file is deleted
// from the store once the listing is saved (never before, so a failed save
// can't leave the listing pointing at a deleted file).
//
// When a change to the booking rules (hours, lengths, days, session,
// capacity) would leave upcoming bookings outside them, or a time slot
// booked beyond the new capacity, nothing is saved the first time: the
// result carries `impact` so the form can say so, and saving again with
// confirmImpact keeps the bookings and applies the change. Those bookings
// are never cancelled here - they were valid when made. Edits that leave
// the rules as they are (name, price, photo...) skip the check: a booking
// already outside the rules was outside them before, and warning about it
// on every save would make a photo change look like it affects bookings.
export const updateListing = withPermission(
  "venues:manage",
  async (session, listingId: string, input: ListingFormInput, confirmImpact: boolean): Promise<SaveListingResult> => {
    if (!isId(listingId)) return { ok: false, error: LISTING_NOT_FOUND };
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        activityId: true,
        imageUrl: true,
        ...BOOKING_RULE_SELECT,
        activity: { select: { bookingMechanic: true, isAccommodation: true } },
        venue: { select: { id: true, ownerId: true, city: { select: { timezone: true } } } },
      },
    });
    if (!listing || !canManageListing(session.user, listing)) return { ok: false, error: LISTING_NOT_FOUND };

    const parsed = parseListing(listingKindFor(listing.activity), { ...input, activityId: listing.activityId });
    if (!parsed.ok) return parsed;
    // Only a changed photo needs checking; the stored one was checked when
    // it was saved.
    const newImage = parsed.data.imageUrl;
    if (newImage && newImage !== listing.imageUrl) {
      const imageError = await checkVenueImageUrl(newImage, listing.venue.id);
      if (imageError) return { ok: false, fieldErrors: { imageUrl: imageError } };
    }

    const columns = toListingColumns(parsed.data);
    const rulesChanged = BOOKING_RULE_COLUMNS.some((column) => columns[column] !== listing[column]);

    if (rulesChanged && confirmImpact !== true) {
      const now = new Date();
      const bookings = await prisma.booking.findMany({
        where: { listingId: listing.id, status: { not: "cancelled" }, endsAt: { gt: upcomingQueryCutoff(now) } },
        select: { orderId: true, startsAt: true, endsAt: true, quantity: true },
      });
      const timeZone = listing.venue.city.timezone;
      const upcoming = bookings.filter((booking) =>
        isUpcomingBooking(booking, timeZone, listing.activity.bookingMechanic, now)
      );
      const impact = assessListingImpact(upcoming, parsed.data, timeZone);
      if (impact.ordersOutsideSchedule > 0 || impact.peakOverCapacity !== null) return { ok: false, impact };
    }

    await prisma.listing.update({ where: { id: listing.id }, data: columns });
    if (listing.imageUrl && listing.imageUrl !== newImage) await deleteReplacedListingImage(listing.imageUrl);
    return { ok: true, listingId: listing.id, venueId: listing.venue.id };
  }
);
