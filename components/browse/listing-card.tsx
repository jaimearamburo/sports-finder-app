import Image from "next/image";
import Link from "next/link";
import { Settings } from "lucide-react";
import type { Activity, City, Country, Listing, Tag, Venue } from "../../generated/prisma/client";
import { cn } from "@/lib/utils";
import { tagTextColor } from "@/lib/label-styles";

export type ListingCardData = Listing & {
  activity: Activity & { tags: { tag: Tag }[] };
  venue: Venue & { city: City & { country: Country } };
  // Set only for classes while the browse date filter is active (see
  // ListingSection). Undefined means no date filter: getMetaLine shows general
  // capacity instead of a live count.
  dateFilterSpots?: { spotsLeft: number | null };
};

// The listing's first tag, used wherever one representative tag is needed (the
// card's accent colour, browse section grouping) so they agree. An activity can
// carry several tags.
export function getPrimaryTag<T>(listing: { activity: { tags: { tag: T }[] } }): T | undefined {
  return listing.activity.tags[0]?.tag;
}

// The fields the card shows. Satisfied by a database record and by the
// dashboard's live preview, so the preview is the real card.
export type CardFields = {
  name: string;
  // Vercel Blob URL of the photo; null or absent shows the tag emoji.
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

// Mechanic-specific line: length bounds, day range, or session length plus
// spots. Shared with the listing page. Shows a live spots count only when
// dateFilterSpots is set (browse with a date filter); otherwise general
// capacity.
export function getMetaLine(listing: CardFields): string {
  switch (listing.activity.bookingMechanic) {
    case "time_range":
      return `${listing.minDurationMinutes}–${listing.maxDurationMinutes} min`;
    case "date_range": {
      // Passes read in days, stays in nights.
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
          ? null // unlimited capacity
          : spotsLeft <= 0
            ? "Fully booked"
            : `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`;
      return spotsText ? `${listing.sessionDurationMinutes} min · ${spotsText}` : `${listing.sessionDurationMinutes} min`;
    }
  }
}

// The fields the price helpers read, so the dashboard can format prices without
// a full card.
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

// "Free" for zero; shared by the card and the listing page.
export function formatPrice(listing: PriceFields): string {
  const amount = Number(listing.pricePerUnit.toString());
  if (amount === 0) return "Free";
  // Whole amounts stay short ("$28"); others always show two decimals
  // ("$26.50").
  const shown = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `$${shown}${getPriceSuffix(listing)}`;
}

// Cards at the top whose photos load eagerly: about one row (2 on phones, 4-5
// on desktop). They're visible on arrival and usually the largest images; the
// rest load lazily.
export const EAGER_CARD_COUNT = 4;

export function ListingGrid({
  listings,
  eagerCount = 0,
  editableIds,
}: {
  listings: ListingCardData[];
  eagerCount?: number;
  // Listings this visitor may edit; their cards get the edit shortcut.
  editableIds?: ReadonlySet<string>;
}) {
  return (
    // Two stretchy columns on phones (fixed widths left an awkward gap); from
    // sm up, fixed-width auto-fill tracks keep cards a consistent size.
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,180px)] sm:gap-4 md:grid-cols-[repeat(auto-fill,220px)]">
      {listings.map((listing, index) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          href={`/listings/${listing.id}`}
          eager={index < eagerCount}
          editHref={editableIds?.has(listing.id) ? `/dashboard/listings/${listing.id}` : undefined}
        />
      ))}
    </div>
  );
}

// Shared with ListingCardSkeleton so its text bones match.
export const CARD_EYEBROW_TEXT_CLASS = "text-xs font-bold tracking-wide uppercase";
export const CARD_TITLE_TEXT_CLASS = "text-[1.05rem] leading-tight font-semibold";
export const CARD_VENUE_TEXT_CLASS = "text-sm";
export const CARD_LOCATION_TEXT_CLASS = "text-xs";
export const CARD_META_TEXT_CLASS = "text-sm";
// The photo area, shared with the skeleton. 3:2 on phones, where the card is
// half the screen wide; fixed heights from sm up, where the columns have fixed
// widths.
export const CARD_IMAGE_AREA_CLASS = "aspect-[3/2] sm:aspect-auto sm:h-28 md:h-32";

// The photo's display width per breakpoint, matching ListingGrid's columns, so
// the browser picks the smallest sharp copy. Change it with the grid.
const CARD_IMAGE_SIZES = "(min-width: 768px) 220px, (min-width: 640px) 180px, 50vw";

// `href`: a clickable browse card; without it, a non-interactive block (the
// dashboard preview). `eager`: load the photo immediately (EAGER_CARD_COUNT).
// `editHref`: shows the edit gear (EditShortcut).
export function ListingCard({
  listing,
  href,
  eager = false,
  editHref,
}: {
  listing: CardFields;
  href?: string;
  eager?: boolean;
  editHref?: string;
}) {
  const tag = getPrimaryTag(listing);
  // Tag colours are data, so the top edge colour comes from an inline style.
  const frameClass = "block h-full overflow-hidden rounded-[5px] border border-t-[3px] bg-card text-card-foreground";
  const frameStyle = { borderTopColor: tag?.color };
  const body = (
    <>
      <div className={cn("relative grid place-items-center bg-muted/60 text-2xl sm:text-3xl", CARD_IMAGE_AREA_CLASS)}>
        {listing.imageUrl ? (
          // Cropped to fill (object-cover). Empty alt: the card text already
          // names the listing.
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
        {/* Hidden at the smallest size: the activity line matters least on a
            narrow card. */}
        {/* With an edit shortcut, this line (the title on phones) leaves room
            for the gear. */}
        <p
          className={cn(CARD_EYEBROW_TEXT_CLASS, "mb-1 hidden sm:block", editHref && "pr-6")}
          style={{ color: tag?.color && tagTextColor(tag.color) }}
        >
          {listing.activity.name}
        </p>
        <p className={cn(CARD_TITLE_TEXT_CLASS, "line-clamp-1", editHref && "pr-6 sm:pr-0")}>{listing.name}</p>
        <p className={cn(CARD_VENUE_TEXT_CLASS, "line-clamp-1 text-muted-foreground")}>{listing.venue.name}</p>
        {/* Its own line, so a long venue name can't push it out of view. */}
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

  // h-full matches the card to its grid row.
  const card = href ? (
    <Link href={href} className={cn(frameClass, "transition-shadow hover:shadow-md")} style={frameStyle}>
      {body}
    </Link>
  ) : (
    <div className={frameClass} style={frameStyle}>
      {body}
    </div>
  );
  if (!editHref) return card;

  // The shortcut is a sibling laid over the card: the card is a link, and links
  // can't nest. The wrapper becomes the grid item.
  return (
    <div className="relative h-full">
      {card}
      <EditShortcut href={editHref} listingName={listing.name} />
    </div>
  );
}

// A gear for people who manage the listing, opening its edit page in a new tab.
// Only a shortcut: the edit page does its own checks.
//
// It sits at the right end of the activity line (the title line on phones).
// Because the card is a link, the gear lives in a transparent overlay that
// repeats the card's spacing (3px top border, CARD_IMAGE_AREA_CLASS, body
// padding, 1px side border) so it lands on that line at every width. Only the
// gear takes clicks.
function EditShortcut({ href, listingName }: { href: string; listingName: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0">
      <div className={cn("mt-[3px]", CARD_IMAGE_AREA_CLASS)} />
      <div className="flex h-5 items-center justify-end pt-2.5 pr-[11px] box-content sm:h-4 sm:pt-3.5 sm:pr-[15px]">
        {/* No prefetch: it opens in a new tab. A 24px target around a 16px
            icon, offset so the icon aligns with the text edge. */}
        <Link
          href={href}
          prefetch={false}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Edit ${listingName} (opens in a new tab)`}
          title="Edit listing"
          className="pointer-events-auto -m-1 flex size-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
        >
          {/* Filled gear in the muted grey (darker on hover); its centre circle
              uses the card colour so the cog keeps its hole. */}
          <Settings aria-hidden className="size-4 fill-current [&>circle]:fill-card" />
        </Link>
      </div>
    </div>
  );
}
