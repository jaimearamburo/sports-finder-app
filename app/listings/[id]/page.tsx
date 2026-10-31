import Image from "next/image";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BackButton } from "@/components/listings/back-button";
import { SlotPicker } from "@/components/listings/slot-picker";
import { ActiveHoldBanner } from "@/components/listings/active-hold-banner";
import { ScrollToTopOnOpen } from "@/components/listings/scroll-to-top-on-open";
import type { PickerListing } from "@/components/listings/picker-types";
import { getBookableDates, getSpotsRemaining, getOccupiedIntervals, getFullyBookedDates } from "@/lib/availability";
import { SAME_DAY_CUTOFF_BUFFER_MINUTES } from "@/lib/time-of-day";
import { getScheduleLine } from "@/lib/listing-schedule";
import { tagTextColor } from "@/lib/label-styles";
import { VenueLocalTime } from "@/components/listings/venue-local-time";
import { getMetaLine, formatPrice } from "@/components/browse/listing-card";

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      activity: { include: { tags: { include: { tag: true } } } },
      venue: { include: { city: { include: { country: true } } } },
    },
  });

  // Archived listings get the same "no longer available" page as a nonexistent
  // id.
  if (!listing || listing.archivedAt) {
    notFound();
  }

  const tags = listing.activity.tags.map(({ tag }) => tag);
  const accentColor = tags[0]?.color;
  const scheduleLine = getScheduleLine(listing);
  const bookableDates = await getBookableDates(listing);

  // The user's active hold anywhere (at most one), for the banner.
  const session = await auth();
  const activeHold = session
    ? await prisma.bookingHold.findFirst({
        where: { userId: session.user.id, expiresAt: { gt: new Date() } },
        select: {
          orderId: true,
          listingId: true,
          listing: { select: { name: true, venue: { select: { name: true } } } },
        },
      })
    : null;

  // Spots per class occurrence, shown inside the picker beside each occurrence.
  // Other mechanics pass undefined.
  const spotsRemaining =
    listing.activity.bookingMechanic === "fixed_session"
      ? await getSpotsRemaining(listing, bookableDates, listing.venue.city.timezone)
      : undefined;

  // Occupancy fetched once and passed down, so the pickers disable booked slots
  // and dates up front.
  const occupiedIntervals =
    listing.activity.bookingMechanic === "time_range"
      ? await getOccupiedIntervals(listing, bookableDates, listing.venue.city.timezone)
      : undefined;

  const fullyBookedDates =
    listing.activity.bookingMechanic === "date_range"
      ? await getFullyBookedDates(listing, bookableDates)
      : undefined;

  const pickerListing: PickerListing = {
    bookingMechanic: listing.activity.bookingMechanic,
    pricePerUnit: Number(listing.pricePerUnit),
    operatingHoursStart: listing.operatingHoursStart,
    operatingHoursEnd: listing.operatingHoursEnd,
    minDurationMinutes: listing.minDurationMinutes,
    maxDurationMinutes: listing.maxDurationMinutes,
    incrementMinutes: listing.incrementMinutes,
    minDurationDays: listing.minDurationDays,
    maxDurationDays: listing.maxDurationDays,
    recurrenceStartTime: listing.recurrenceStartTime,
    sessionDurationMinutes: listing.sessionDurationMinutes,
    isAccommodation: listing.activity.isAccommodation,
    capacity: listing.capacity,
    maxBookingsPerTransaction: listing.maxBookingsPerTransaction,
    venueTimezone: listing.venue.city.timezone,
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-7 sm:px-6">
      <ScrollToTopOnOpen />
      {activeHold && (
        <ActiveHoldBanner
          orderId={activeHold.orderId}
          listingId={activeHold.listingId}
          listingName={activeHold.listing.name}
          venueName={activeHold.listing.venue.name}
        />
      )}

      {/* Blurred and inert, not removed, while a hold elsewhere needs
          resolving. */}
      <div className={activeHold ? "pointer-events-none blur-sm select-none" : undefined}>
      <BackButton className="inline-flex min-h-6 items-center text-sm text-muted-foreground hover:text-foreground">
        ← Go back
      </BackButton>

      <div className="mt-4 overflow-hidden rounded-md border bg-card shadow-sm">
        {listing.imageUrl ? (
          // The listing's photo cropped to a fixed shape (3:2 on phones, 2:1
          // from sm up). The page's main image, so loaded first. `sizes`: full
          // width on phones, at most 720px from md up.
          <div
            className="relative aspect-[3/2] border-t-[3px] bg-muted/60 sm:aspect-[2/1]"
            style={{ borderTopColor: accentColor }}
          >
            <Image
              src={listing.imageUrl}
              alt={`${listing.name} at ${listing.venue.name}`}
              fill
              sizes="(min-width: 768px) 720px, 100vw"
              loading="eager"
              fetchPriority="high"
              className="object-cover"
            />
          </div>
        ) : (
          <div
            className="grid h-64 place-items-center border-t-[3px] bg-muted/60 text-6xl"
            style={{ borderTopColor: accentColor }}
          >
            {tags[0]?.emoji}
          </div>
        )}

        <div className="p-6">
          <div>
            <p
              className="mb-1 text-xs font-bold tracking-wide uppercase"
              style={{ color: accentColor && tagTextColor(accentColor) }}
            >
              {listing.activity.name}
            </p>
            <h1 className="text-2xl font-bold">{listing.name}</h1>
            <p className="mt-1 text-muted-foreground">
              {listing.venue.name}, {listing.venue.city.name}
            </p>
          </div>

          {tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 mb-4">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{ backgroundColor: `${tag.color}1a`, color: tagTextColor(tag.color) }}
                >
                  {tag.emoji} {tag.name}
                </span>
              ))}
            </div>
          )}

          <VenueLocalTime timeZone={listing.venue.city.timezone} cityName={listing.venue.city.name} />

          <div className="mt-6 flex items-baseline justify-between border-t pt-4">
            <div className="text-sm text-muted-foreground">
              {scheduleLine && <p>{scheduleLine}</p>}
              {/* Explains why today can drop out of the calendar later in the
                  day (isSameDayBookingClosed). */}
              {listing.activity.bookingMechanic === "date_range" && listing.operatingHoursEnd && (
                <p>
                  Same-day bookings close {SAME_DAY_CUTOFF_BUFFER_MINUTES / 60} hour
                  {SAME_DAY_CUTOFF_BUFFER_MINUTES === 60 ? "" : "s"} before{" "}
                  {listing.activity.isAccommodation ? "check-in closes" : "closing"}
                </p>
              )}
              <p>{getMetaLine(listing)}</p>
            </div>
            <p className="font-mono text-xl font-semibold">{formatPrice(listing)}</p>
          </div>

          <div className="mt-6 border-t pt-6">
            <SlotPicker
              listingId={listing.id}
              listing={pickerListing}
              bookableDates={bookableDates}
              spotsRemaining={spotsRemaining}
              occupiedIntervals={occupiedIntervals}
              fullyBookedDates={fullyBookedDates}
            />
          </div>

          {(listing.description ?? listing.activity.description) && (
            <p className="mt-6 text-sm text-muted-foreground">
              {listing.description ?? listing.activity.description}
            </p>
          )}

          <div className="mt-8 border-t pt-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{listing.venue.name}</p>
            <p>{listing.venue.address}</p>
            <p>{listing.venue.city.name}</p>
          </div>
        </div>

        {/* Full-bleed like the photo, so it sits outside the padded block.
            Google's key-free query-string embed: no API key, Cloud project or
            billing needed. */}
        <iframe
          title={`Map of ${listing.venue.name}`}
          src={`https://www.google.com/maps?q=${encodeURIComponent(`${listing.venue.address}, ${listing.venue.city.name}`)}&output=embed`}
          className="h-64 w-full border-0"
          loading="lazy"
        />
      </div>
      </div>
    </div>
  );
}
