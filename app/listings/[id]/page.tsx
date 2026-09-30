import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/listings/back-button";
import {
  getMetaLine,
  formatPrice,
  type ListingCardData,
} from "@/components/browse/listing-card";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Listing.operatingHoursStart/End and recurrenceStartTime are stored as
// plain "HH:MM" wall-clock strings (see schema.prisma) - not full
// timestamps - so this is pure string formatting, not a timezone
// conversion. The value already IS the venue's local time; there's
// nothing to convert it from or to.
function formatTimeOfDay(time: string): string {
  const [hourStr, minute] = time.split(":");
  const hour = Number(hourStr);
  const period = hour < 12 ? "AM" : "PM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute} ${period}`;
}

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

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-7 sm:px-6">
      <BackButton className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to browse
      </BackButton>

      <div
        className="mt-4 grid h-64 place-items-center rounded-[5px] border-t-[3px] bg-muted/60 text-6xl"
        style={{ borderTopColor: accentColor }}
      >
        {tags[0]?.emoji}
      </div>

      <div className="mt-5">
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
        <div className="mt-4 flex flex-wrap gap-2">
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

      <div className="mt-6 flex items-baseline justify-between border-t pt-4">
        <div className="text-sm text-muted-foreground">
          {scheduleLine && <p>{scheduleLine}</p>}
          <p>{getMetaLine(listing)}</p>
        </div>
        <p className="font-mono text-xl font-semibold">{formatPrice(listing)}</p>
      </div>

      <Button disabled className="mt-6 w-full" size="lg">
        Booking coming soon
      </Button>

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

      {/* Google's plain query-string embed, not the Maps Embed API - this
          form needs no API key, no Google Cloud project, and no billing
          setup at all, unlike the "official" embed API which is also free
          of charge but still requires all of that just to get a key. 
          This is good enough for the MVP */}
      <iframe
        title={`Map of ${listing.venue.name}`}
        src={`https://www.google.com/maps?q=${encodeURIComponent(`${listing.venue.address}, ${listing.venue.city.name}`)}&output=embed`}
        className="mt-4 h-64 w-full rounded-[5px] border-0"
        loading="lazy"
      />
    </div>
  );
}
