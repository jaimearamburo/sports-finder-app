import Link from "next/link";
import type { Activity, Resource, Tag, Venue } from "../../generated/prisma/client";
import { cn } from "@/lib/utils";

export type ResourceCardData = Resource & {
  activity: Activity & { tags: { tag: Tag }[] };
  venue: Venue;
};

// A Resource's Activity can carry several tags. "Tennis Class" is tagged
// both "Tennis" and "Classes". Anything that needs one representative tag
// for this resource (this card's accent color, and the browse page's
// section grouping) uses the first, so both agree on the same tag. Returns
// the full Tag record rather than just its name; callers that only need
// the name for grouping read `.name` off the result.
export function getPrimaryTag(resource: ResourceCardData): Tag | undefined {
  return resource.activity.tags[0]?.tag;
}

// Booking-mechanic-specific line: duration bounds, night range, or
// session length plus spots.
function getMetaLine(resource: ResourceCardData): string {
  switch (resource.activity.bookingMechanic) {
    case "time_range":
      return `${resource.minDurationMinutes}–${resource.maxDurationMinutes} min`;
    case "date_range":
      return `${resource.minDurationDays}–${resource.maxDurationDays} nights`;
    case "fixed_session":
      return `${resource.sessionDurationMinutes} min · ${resource.capacity} spots`;
  }
}

function getPriceSuffix(resource: ResourceCardData): string {
  switch (resource.activity.bookingMechanic) {
    case "time_range":
      return "/hr";
    case "date_range":
      return "/night";
    case "fixed_session":
      return "";
  }
}

export function ResourceGrid({ resources }: { resources: ResourceCardData[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
      {resources.map((resource) => (
        <ResourceCard key={resource.id} resource={resource} />
      ))}
    </div>
  );
}

// Shared with ResourceCardSkeleton so the skeleton's text bones track
// whatever typography the real card uses.
export const CARD_EYEBROW_TEXT_CLASS = "text-xs font-bold tracking-wide uppercase";
export const CARD_TITLE_TEXT_CLASS = "text-[1.05rem] leading-tight font-semibold";
export const CARD_VENUE_TEXT_CLASS = "text-sm";
export const CARD_META_TEXT_CLASS = "text-sm";

export function ResourceCard({ resource }: { resource: ResourceCardData }) {
  const tag = getPrimaryTag(resource);

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
          {resource.activity.name}
        </p>
        <p className={CARD_TITLE_TEXT_CLASS}>{resource.name}</p>
        <p className={cn(CARD_VENUE_TEXT_CLASS, "mb-2.5 text-muted-foreground")}>
          {resource.venue.name}, {resource.venue.city}
        </p>
        <div className={cn(CARD_META_TEXT_CLASS, "flex items-baseline justify-between text-muted-foreground")}>
          <span>{getMetaLine(resource)}</span>
          <span className="font-mono font-semibold text-foreground">
            ${resource.pricePerUnit.toString()}
            {getPriceSuffix(resource)}
          </span>
        </div>
      </div>
    </Link>
  );
}
