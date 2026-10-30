import Image from "next/image";
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
export function getPrimaryTag<T>(listing: { activity: { tags: { tag: T }[] } }): T | undefined {
  return listing.activity.tags[0]?.tag;
}

// Just the fields the card itself shows. ListingCardData (a full database
// record) satisfies it, and so does the venue dashboard's live preview,
// which builds one from the listing form as it's typed - so the preview is
// the real card, not a copy that could drift.
export type CardFields = {
  name: string;
  // The listing's photo (a Vercel Blob URL), or null/absent to show the
  // tag emoji instead.
  imageUrl?: string | null;
  pricePerUnit: { toString(): string };
  capacity: number | null;
  minDurationMinutes: number | null;
  maxDurationMinutes: number | null;
  minDurationDays: number | null;
  maxDurationDays: number | null;
  sessionDurationMinutes: number | null;
  activity: {
    name: string;
    bookingMechanic: "time_range" | "date_range" | "fixed_session";
    isAccommodation: boolean;
    tags: { tag: { emoji: string; color: string } }[];
  };
  venue: { name: string; city: { name: string; country: { name: string } } };
  dateFilterSpots?: { spotsLeft: number | null };
};

// Booking-mechanic-specific line: duration bounds, day range, or session
// length plus spots. Exported so the listing detail page can reuse the
// exact same compact wording rather than re-deriving it. Fully data-driven
// off what's attached to the listing - no caller-supplied mode - so the
// detail page (which never sets dateFilterSpots) and the browse grid's
// default, unfiltered state naturally agree on the cheap, query-free
// "capacity" wording, while the browse grid's date-filtered state (the
// only time dateFilterSpots is set - see ListingSection) gets the live
// count instead.
export function getMetaLine(listing: CardFields): string {
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

// Just the fields the price helpers read, so the venue dashboard can format
// prices the same way without loading a whole card's worth of data.
export type PriceFields = {
  pricePerUnit: { toString(): string };
  activity: { bookingMechanic: "time_range" | "date_range" | "fixed_session"; isAccommodation: boolean };
};

export function getPriceSuffix(listing: PriceFields): string {
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
export function formatPrice(listing: PriceFields): string {
  const amount = Number(listing.pricePerUnit.toString());
  if (amount === 0) return "Free";
  // Whole amounts stay short ("$28"); anything with cents always shows two
  // places ("$26.50", never "$26.5").
  const shown = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `$${shown}${getPriceSuffix(listing)}`;
}

// How many cards at the top of the page load their photo straight away
// rather than lazily: about one row on most screens (2 on phones, 4-5 on
// desktop). Those are visible on arrival, and usually the page's largest
// image, so waiting for them to scroll into view would only delay what
// people see first. Every other photo loads as it nears the screen.
export const EAGER_CARD_COUNT = 4;

export function ListingGrid({ listings, eagerCount = 0 }: { listings: ListingCardData[]; eagerCount?: number }) {
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
      {listings.map((listing, index) => (
        <ListingCard key={listing.id} listing={listing} href={`/listings/${listing.id}`} eager={index < eagerCount} />
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
// The card's photo area, shared with the skeleton so loading and loaded
// cards are the same size. A 3:2 frame on phones - the card's width there
// is half the screen, so a fixed height would get flatter (and crop more
// of a photo) the wider the phone; 3:2 keeps it about as tall as the
// tablet card. From sm up the grid's columns have fixed widths, so fixed
// heights give the same shape.
export const CARD_IMAGE_AREA_CLASS = "aspect-[3/2] sm:aspect-auto sm:h-28 md:h-32";

// The photo's display width at each breakpoint, matching ListingGrid's
// columns: half the screen on phones (two columns), then the fixed 180px
// and 220px tracks. The browser uses it to pick the smallest resized copy
// that's still sharp on its screen (a phone at 3x density gets ~560px wide,
// not the original upload), so it must change if the grid's widths do.
const CARD_IMAGE_SIZES = "(min-width: 768px) 220px, (min-width: 640px) 180px, 50vw";

// `href` set: the clickable card used in browse. Left out: the same card as
// a plain, non-interactive block - the dashboard's live preview, where
// there's no saved listing to link to yet. `eager`: load the photo
// straight away (see EAGER_CARD_COUNT).
export function ListingCard({ listing, href, eager = false }: { listing: CardFields; href?: string; eager?: boolean }) {
  const tag = getPrimaryTag(listing);
  // Color comes from the database via inline style rather than a per-tag
  // CSS class, since tags are editable data with no fixed set of colors to
  // pre-write classes for. Only the top edge picks up the tag color; the
  // other three sides stay the default neutral border.
  const frameClass = "block h-full overflow-hidden rounded-[5px] border border-t-[3px] bg-card text-card-foreground";
  const frameStyle = { borderTopColor: tag?.color };
  const body = (
    <>
      <div className={cn("relative grid place-items-center bg-muted/60 text-2xl sm:text-3xl", CARD_IMAGE_AREA_CLASS)}>
        {listing.imageUrl ? (
          // Cropped to fill the area (object-cover, centred), whatever the
          // photo's own shape. Empty alt: the card's text already names the
          // listing, so describing the photo would only repeat it.
          <Image
            src={listing.imageUrl}
            alt=""
            fill
            sizes={CARD_IMAGE_SIZES}
            loading={eager ? "eager" : "lazy"}
            className="object-cover"
          />
        ) : (
          tag?.emoji
        )}
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
    </>
  );

  // h-full has no visible effect in the browse grid: ListingCard is already
  // a direct grid item, and CSS Grid's default align-items: stretch already
  // matches it to its row's height.
  return href ? (
    <Link href={href} className={cn(frameClass, "transition-shadow hover:shadow-md")} style={frameStyle}>
      {body}
    </Link>
  ) : (
    <div className={frameClass} style={frameStyle}>
      {body}
    </div>
  );
}
