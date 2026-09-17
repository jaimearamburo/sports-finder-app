import Link from "next/link";
import type { Activity, City, Listing, Tag, Venue } from "../../generated/prisma/client";
import { cn } from "@/lib/utils";

export type ListingCardData = Listing & {
  activity: Activity & { tags: { tag: Tag }[] };
  venue: Venue & { city: City };
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
// length plus spots.
function getMetaLine(listing: ListingCardData): string {
  switch (listing.activity.bookingMechanic) {
    case "time_range":
      return `${listing.minDurationMinutes}–${listing.maxDurationMinutes} min`;
    case "date_range":
      return `${listing.minDurationDays}–${listing.maxDurationDays} day${listing.maxDurationDays === 1 ? "" : "s"}`;
    case "fixed_session":
      return `${listing.sessionDurationMinutes} min · ${listing.capacity === null ? "Unlimited spots" : `${listing.capacity} spots`}`;
  }
}

function getPriceSuffix(listing: ListingCardData): string {
  switch (listing.activity.bookingMechanic) {
    case "time_range":
      return "/hr";
    case "date_range":
      return "/day";
    case "fixed_session":
      return "";
  }
}

export function ListingGrid({ listings }: { listings: ListingCardData[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
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
export const CARD_META_TEXT_CLASS = "text-sm";

export function ListingCard({ listing }: { listing: ListingCardData }) {
  const tag = getPrimaryTag(listing);

  return (
    <Link
      href="#"
      // Color comes from the database via inline style rather than a
      // per-tag CSS class, since tags are editable data with no fixed set
      // of colors to pre-write classes for. Only the top edge picks up
      // the tag color; the other three sides stay the default neutral
      // border.
      className="block overflow-hidden rounded-[5px] border border-t-[3px] bg-card text-card-foreground transition-shadow hover:shadow-md"
      style={{ borderTopColor: tag?.color }}
    >
      <div className="grid h-32 place-items-center bg-muted/60 text-3xl">{tag?.emoji}</div>
      <div className="p-3.5">
        <p className={cn(CARD_EYEBROW_TEXT_CLASS, "mb-1")} style={{ color: tag?.color }}>
          {listing.activity.name}
        </p>
        <p className={CARD_TITLE_TEXT_CLASS}>{listing.name}</p>
        <p className={cn(CARD_VENUE_TEXT_CLASS, "mb-2.5 text-muted-foreground")}>
          {listing.venue.name}, {listing.venue.city.name}
        </p>
        <div className={cn(CARD_META_TEXT_CLASS, "flex items-baseline justify-between text-muted-foreground")}>
          <span>{getMetaLine(listing)}</span>
          <span className="font-mono font-semibold text-foreground">
            {Number(listing.pricePerUnit) === 0
              ? "Free"
              : `$${listing.pricePerUnit.toString()}${getPriceSuffix(listing)}`}
          </span>
        </div>
      </div>
    </Link>
  );
}
