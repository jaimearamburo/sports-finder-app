import { prisma } from "@/lib/prisma";
import { ListingGrid, getPrimaryTag, type ListingCardData } from "@/components/browse/listing-card";
import { isCategoryId, MECHANIC_CATEGORIES, type CategoryId } from "@/lib/category-filters";
import { PRICE_MIN, PRICE_MAX } from "@/lib/price-range";

// All URL search params ListingSection's query can filter on. Every
// value is a raw string (or absent) since it comes straight off the URL;
// parsing and validation happen inside ListingSection itself. Shared with
// app/page.tsx so the two stay in sync as filters are added, rather than
// each redeclaring the same shape.
export type BrowseSearchParams = {
  category?: string;
  tags?: string;
  city?: string;
  priceMin?: string;
  priceMax?: string;
};

// The slow part of the browse page, isolated into its own component so
// app/page.tsx can wrap only this in Suspense. The sidebar and chip row
// render immediately regardless of how long this query takes.
export async function ListingSection({ searchParams }: { searchParams: BrowseSearchParams }) {
  const {
    category: rawCategory,
    tags: rawTags,
    city,
    priceMin: rawPriceMin,
    priceMax: rawPriceMax,
  } = searchParams;

  const category: CategoryId = rawCategory && isCategoryId(rawCategory) ? rawCategory : "all";
  const selectedTags = rawTags ? rawTags.split(",").filter(Boolean) : [];
  const priceMin = rawPriceMin ? Number(rawPriceMin) : PRICE_MIN;
  const priceMax = rawPriceMax ? Number(rawPriceMax) : PRICE_MAX;

  // Category is the booking-mechanic axis (see lib/category-filters.ts) —
  // its id is the literal BookingMechanic value itself, so it needs no
  // lookup table, just a direct field condition. Tags are a separate,
  // freely-combinable condition (AND'd with category, not merged into it):
  // both go into an AND array rather than being spread into one flat
  // object, since two spreads that both set a key on Activity would let
  // the second silently overwrite the first.
  const activityConditions = [];
  if (category !== "all") activityConditions.push({ bookingMechanic: category });
  if (selectedTags.length > 0) {
    activityConditions.push({
      tags: { some: { tag: { name: { in: selectedTags, mode: "insensitive" as const } } } },
    });
  }

  const listings = await prisma.listing.findMany({
    where: {
      // Retired listings (see Listing.archivedAt) are kept for their
      // booking history but should never show up as bookable again.
      archivedAt: null,
      activity: activityConditions.length > 0 ? { AND: activityConditions } : undefined,
      venue: city ? { city: { name: city } } : undefined,
      // PRICE_MAX is an open-ended "$100+" bound, so only the lower end
      // is enforced once the range reaches it.
      pricePerUnit: {
        gte: priceMin > PRICE_MIN ? priceMin : undefined,
        lte: priceMax < PRICE_MAX ? priceMax : undefined,
      },
    },
    include: {
      activity: { include: { tags: { include: { tag: true } } } },
      venue: { include: { city: true } },
    },
    orderBy: { name: "asc" },
  });

  if (listings.length === 0) {
    return <p className="mt-10 text-sm text-muted-foreground">No results match these filters.</p>;
  }

  // Top-level grouping is by booking mechanic rather than tag: it's the
  // bigger structural difference between listings (a court you book by
  // time range books completely differently from a class you book into a
  // fixed session), so it makes a better first cut than the cross-cutting
  // tag grouping used within each mechanic below. MECHANIC_CATEGORIES
  // fixes the section order; a mechanic with no results in this query
  // just doesn't get a section of its own. The heading always renders,
  // even when only one mechanic is present (e.g. the sidebar's category
  // filter narrows to a single one) - a long single-mechanic result list
  // still needs a visible label once it's long enough to scroll past
  // whatever filter the user picked to get there.
  const byMechanic = new Map<string, typeof listings>();
  for (const listing of listings) {
    const mechanic = listing.activity.bookingMechanic;
    const bucket = byMechanic.get(mechanic);
    if (bucket) {
      bucket.push(listing);
    } else {
      byMechanic.set(mechanic, [listing]);
    }
  }
  const mechanicGroups = MECHANIC_CATEGORIES.filter((type) => byMechanic.has(type.id));

  return (
    <div className="mt-6 flex flex-col gap-10">
      {mechanicGroups.map((type) => (
        <section key={type.id}>
          {/* Painted full-width (the section's own width, since `main` in
              app/page.tsx carries no independent horizontal padding of its
              own) */}
          <h2 className="mb-4 border-primary bg-foreground/5 p-1 pl-2 text-lg font-semibold">
            {type.label}
          </h2>
          <TagGroups listings={byMechanic.get(type.id)!} />
        </section>
      ))}
    </div>
  );
}

// Groups a set of listings by primary tag, one h3-headed section per tag.
// Section order comes from each tag's own displayOrder column, fetched
// alongside the listing's activity.tags.tag relation. Listings with no
// tag sort last under "Other".
function TagGroups({ listings }: { listings: ListingCardData[] }) {
  const groups = new Map<string, typeof listings>();
  const groupOrder = new Map<string, number>();
  for (const listing of listings) {
    const tag = getPrimaryTag(listing);
    const key = tag?.name ?? "Other";
    if (!groupOrder.has(key)) groupOrder.set(key, tag?.displayOrder ?? Infinity);
    const group = groups.get(key);
    if (group) {
      group.push(listing);
    } else {
      groups.set(key, [listing]);
    }
  }
  const groupNames = [...groups.keys()].sort(
    (a, b) => groupOrder.get(a)! - groupOrder.get(b)! || a.localeCompare(b)
  );

  return (
    <div className="flex flex-col gap-8">
      {groupNames.map((name) => (
        <section key={name}>
          <h3 className="mb-3 text-sm font-semibold">{name}</h3>
          <ListingGrid listings={groups.get(name)!} />
        </section>
      ))}
    </div>
  );
}
