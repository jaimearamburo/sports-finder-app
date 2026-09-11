import Link from "next/link";
import type { Activity, Resource, Tag, Venue } from "../../generated/prisma/client";
import { cn } from "@/lib/utils";
import { TAG_STYLES } from "@/lib/browse-filters";

export type ResourceCardData = Resource & {
  activity: Activity & { tags: { tag: Tag }[] };
  venue: Venue;
};

// 
export function getPrimaryTagName(resource: ResourceCardData): string | undefined {
  return resource.activity.tags[0]?.tag.name;
}

// Booking-mechanic-specific line (duration bounds, night range, or session length + spots)
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

//
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

export function ResourceCard({ resource }: { resource: ResourceCardData }) {
  const primaryTag = getPrimaryTagName(resource);
  const style = primaryTag ? TAG_STYLES[primaryTag] : undefined;

  return (
    <Link
      href="#"
      className={cn(
        "block overflow-hidden rounded-[5px] border border-t-[3px] bg-card text-card-foreground transition-shadow hover:shadow-md",
        style && `border-t-tag-${style.slug}`
      )}
    >
      <div className="grid h-32 place-items-center bg-muted/60 text-3xl">{style?.emoji ?? "🏷️"}</div>
      <div className="p-3.5">
        <p
          className={cn(
            "mb-1 text-xs font-bold tracking-wide uppercase",
            style ? `text-tag-${style.slug}` : "text-muted-foreground"
          )}
        >
          {resource.activity.name}
        </p>
        <p className="text-[1.05rem] leading-tight font-semibold">{resource.name}</p>
        <p className="mb-2.5 text-sm text-muted-foreground">
          {resource.venue.name}, {resource.venue.city}
        </p>
        <div className="flex items-baseline justify-between text-sm text-muted-foreground">
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
