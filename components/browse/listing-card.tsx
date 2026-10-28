import Link from "next/link";
import type { Activity, City, Country, Listing, Tag, Venue } from "../../generated/prisma/client";
import { cn } from "@/lib/utils";
import { tagTextColor } from "@/lib/label-styles";

export type ListingCardData = Listing & {
  activity: Activity & { tags: { tag: Tag }[] };
  venue: Venue & { city: City & { country: Country } };
  // Only ever attached for fixed_session listings, and only when the
  // browse page's date filter is active (see ListingSection) - undefined
  // means "no date filter," which getMetaLine reads as "show general
  // capacity metadata" instead of a live count. A fixed_session listing
  // that doesn't occur on the filtered date is excluded from the grid
  // entirely rather than reaching this field with some "not held" state -
  // see ListingSection's per-date filtering.
  dateFilterSpots?: { spotsLeft: number | null };
};

// A Listing's Activity can carry several tags. "Tennis Class" is tagged
// both "Tennis" and "Classes". Anything that needs one representative tag
// for this listing (this card's accent color, and the browse page's
// section grouping) uses the first, so both agree on the same tag. Returns
// the full Tag record rather than just its name; callers that only need
// the name for grouping read `.name` off the result.
export function getPrimaryTag(listing: ListingCardData): Tag | undefined {
  return listing.activity.tags[0]?.tag;
}

// Booking-mechanic-specific line: duration bounds, day range, or session
// length plus spots. Exported so the listing detail page can reuse the
// exact same compact wording rather than re-deriving it. Fully data-driven
// off what's attached to the listing - no caller-supplied mode - so the
// detail page (which never sets dateFilterSpots) and the browse grid's
// default, unfiltered state naturally agree on the cheap, query-free
// "capacity" wording, while the browse grid's date-filtered state (the
// only time dateFilterSpots is set - see ListingSection) gets the live
// count instead.
export function getMetaLine(listing: ListingCardData): string {
  switch (listing.activity.bookingMechanic) {
    case "time_range":
      return `${listing.minDurationMinutes}–${listing.maxDurationMinutes} min`;
    case "date_range": {
      // Wording keys off isAccommodation, not the day counts themselves:
      // a multi-day pass reads in "days," a camping stay reads in "nights."
      const { minDurationDays: min, maxDurationDays: max } = listing;
      const unit = listing.activity.isAccommodation ? "night" : "day";
      return min === max ? `${min} ${unit}${min === 1 ? "" : "s"}` : `${min}–${max} ${unit}s`;
    }
    case "fixed_session": {
      if (!listing.dateFilterSpots) {
        return `${listing.sessionDurationMinutes} min · ${listing.capacity === null ? "Unlimited spots" : `max ${listing.capacity} spots`}`;
      }
      const { spotsLeft } = listing.dateFilterSpots;
      const spotsText =
        spotsLeft === null
          ? null // unlimited capacity - nothing to report
          : spotsLeft <= 0
            ? "Fully booked"
            : `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`;
      return spotsText ? `${listing.sessionDurationMinutes} min · ${spotsText}` : `${listing.sessionDurationMinutes} min`;
    }
  }
}

export function getPriceSuffix(listing: ListingCardData): string {
  switch (listing.activity.bookingMechanic) {
    case "time_range":
      return "/hr";
    case "date_range":
      return listing.activity.isAccommodation ? "/night" : "/day";
    case "fixed_session":
      return "";
  }
}

// "Free" for a zero price rather than "$0" - shared by the card and the
// detail page so this formatting rule only lives in one place.
export function formatPrice(listing: ListingCardData): string {
  return Number(listing.pricePerUnit) === 0
    ? "Free"
    : `$${listing.pricePerUnit.toString()}${getPriceSuffix(listing)}`;
}

export function ListingGrid({ listings }: { listings: ListingCardData[] }) {
  return (
    // Mobile gets exactly 2 equal, stretchy columns (grid-cols-2) rather
    // than fixed-width auto-fill columns - at a fixed 150px, 2 columns
    // left a visible strip of unused width on most phone screens before
    // jumping to a 3rd column no one could see without scrolling, which
    // read as broken rather than intentional. From `sm:` up there's
    // enough width that a flat per-breakpoint auto-fill track (not
    // minmax(...,1fr), which would keep stretching indefinitely) is what
    // keeps a card a fixed, consistent size across however many columns
    // actually fit the viewport.
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,180px)] sm:gap-4 md:grid-cols-[repeat(auto-fill,220px)]">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}

// Shared with ListingCardSkeleton so the skeleton's text bones track
// whatever typography the real card uses.
export const CARD_EYEBROW_TEXT_CLASS = "text-xs font-bold tracking-wide uppercase";
export const CARD_TITLE_TEXT_CLASS = "text-[1.05rem] leading-tight font-semibold";
export const CARD_VENUE_TEXT_CLASS = "text-sm";
export const CARD_LOCATION_TEXT_CLASS = "text-xs";
export const CARD_META_TEXT_CLASS = "text-sm";

export function ListingCard({ listing }: { listing: ListingCardData }) {
  const tag = getPrimaryTag(listing);

  return (
    <Link
      href={`/listings/${listing.id}`}
      // Color comes from the database via inline style rather than a
      // per-tag CSS class, since tags are editable data with no fixed set
      // of colors to pre-write classes for. Only the top edge picks up
      // the tag color; the other three sides stay the default neutral
      // border.
      // h-full has no visible effect here: ListingCard is already a direct
      // grid item, and CSS Grid's default align-items: stretch already
      // matches it to its row's height.
      className="block h-full overflow-hidden rounded-[5px] border border-t-[3px] bg-card text-card-foreground transition-shadow hover:shadow-md"
      style={{ borderTopColor: tag?.color }}
    >
      <div className="grid h-20 place-items-center bg-muted/60 text-2xl sm:h-28 sm:text-3xl md:h-32">
        {tag?.emoji}
      </div>
      <div className="p-2.5 sm:p-3.5">
        {/* Dropped at the smallest size, not just shrunk - the category
            name is the least load-bearing line on a card this small
            (title + price already carry the decision), same "fewer
            things, not just smaller things" compactness an app like
            UberEats uses for its own narrow card variant. */}
        <p className={cn(CARD_EYEBROW_TEXT_CLASS, "mb-1 hidden sm:block")} style={{ color: tag?.color && tagTextColor(tag.color) }}>
          {listing.activity.name}
        </p>
        <p className={cn(CARD_TITLE_TEXT_CLASS, "line-clamp-1")}>{listing.name}</p>
        <p className={cn(CARD_VENUE_TEXT_CLASS, "line-clamp-1 text-muted-foreground")}>{listing.venue.name}</p>
        {/* Own line, not appended after the venue name - a long venue
            name would otherwise push this off the end of the line and
            line-clamp-1 would hide it entirely. */}
        <p className={cn(CARD_LOCATION_TEXT_CLASS, "mb-2.5 line-clamp-1 text-muted-foreground")}>
          {listing.venue.city.name}, {listing.venue.city.country.name}
        </p>
        <div className={cn(CARD_META_TEXT_CLASS, "flex items-baseline justify-between text-muted-foreground")}>
          <span>{getMetaLine(listing)}</span>
          <span className="font-mono font-semibold text-foreground">{formatPrice(listing)}</span>
        </div>
      </div>
    </Link>
  );
}
