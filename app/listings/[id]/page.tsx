import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BackButton } from "@/components/listings/back-button";
import { SlotPicker } from "@/components/listings/slot-picker";
import type { PickerListing } from "@/components/listings/picker-types";
import { getBookableDates, getSpotsRemaining } from "@/lib/availability";
import { formatTimeOfDay } from "@/lib/time-of-day";
import { VenueLocalTime } from "@/components/listings/venue-local-time";
import {
  getMetaLine,
  formatPrice,
  type ListingCardData,
} from "@/components/browse/listing-card";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// The schedule-specific fact getMetaLine's compact card wording doesn't
// already cover: operating hours for time_range, which day/time a
// fixed_session recurs on. date_range has no such extra fact - its stay
// length is the whole story, already in getMetaLine - so it returns
// nothing to add there.
function getScheduleLine(listing: ListingCardData): string | null {
  switch (listing.activity.bookingMechanic) {
    case "time_range":
      return listing.operatingHoursStart && listing.operatingHoursEnd
        ? `Open ${formatTimeOfDay(listing.operatingHoursStart)} – ${formatTimeOfDay(listing.operatingHoursEnd)} daily`
        : null;
    case "date_range":
      return null;
    case "fixed_session":
      return listing.recurrenceDayOfWeek !== null && listing.recurrenceStartTime
        ? `Every ${DAY_NAMES[listing.recurrenceDayOfWeek]}, ${formatTimeOfDay(listing.recurrenceStartTime)}`
        : null;
  }
}

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Fetches the listing along with its activity, tags, venue, and city,
  // everything this page and the slot picker below need to render.
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      activity: { include: { tags: { include: { tag: true } } } },
      venue: { include: { city: true } },
    },
  });

  // Archived listings 404 the same as a nonexistent id - both render the
  // same "no longer available" state (app/listings/[id]/not-found.tsx),
  // since a visitor can't tell the difference between "never existed" and
  // "existed, now retired" from a dead link, and shouldn't need to.
  if (!listing || listing.archivedAt) {
    notFound();
  }

  const tags = listing.activity.tags.map(({ tag }) => tag);
  const accentColor = tags[0]?.color;
  const scheduleLine = getScheduleLine(listing);
  const bookableDates = await getBookableDates(listing);

  // Only fixed_session has a concept of "spots remaining per occurrence" -
  // the other two mechanics pass undefined straight through to SlotPicker.
  // This page's own summary line below deliberately doesn't surface any of
  // this itself (see the "max" option on getMetaLine) - it's live,
  // per-occurrence data, and belongs next to the occurrence it describes
  // (inside the picker), not in a page-level summary with no occurrence of
  // its own to attach to.
  const spotsRemaining =
    listing.activity.bookingMechanic === "fixed_session"
      ? await getSpotsRemaining(listing, bookableDates, listing.venue.city.timezone)
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
      <BackButton className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to browse
      </BackButton>

      <div className="mt-4 overflow-hidden rounded-md border bg-card shadow-sm">
        <div
          className="grid h-64 place-items-center border-t-[3px] bg-muted/60 text-6xl"
          style={{ borderTopColor: accentColor }}
        >
          {tags[0]?.emoji}
        </div>

        <div className="p-6">
          <div>
            <p
              className="mb-1 text-xs font-bold tracking-wide uppercase"
              style={{ color: accentColor }}
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
                  style={{ backgroundColor: `${tag.color}1a`, color: tag.color }}
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
              <p>{getMetaLine(listing)}</p>
            </div>
            <p className="font-mono text-xl font-semibold">{formatPrice(listing)}</p>
          </div>

          <div className="mt-6 border-t pt-6">
            <SlotPicker listing={pickerListing} bookableDates={bookableDates} spotsRemaining={spotsRemaining} />
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

        {/* Full-bleed like the hero image, so it's a sibling of the padded
            block rather than nested inside it - overflow-hidden on the
            outer card clips its bottom corners the same way it clips the
            image's top ones. Google's plain query-string embed, not the
            Maps Embed API - this form needs no API key, no Google Cloud
            project, and no billing setup at all, unlike the "official"
            embed API which is also free of charge but still requires all
            of that just to get a key. This is good enough for the MVP. */}
        <iframe
          title={`Map of ${listing.venue.name}`}
          src={`https://www.google.com/maps?q=${encodeURIComponent(`${listing.venue.address}, ${listing.venue.city.name}`)}&output=embed`}
          className="h-64 w-full border-0"
          loading="lazy"
        />
      </div>
    </div>
  );
}
