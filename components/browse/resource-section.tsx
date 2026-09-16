import { prisma } from "@/lib/prisma";
import { ResourceGrid, getPrimaryTag } from "@/components/browse/resource-card";
import { CATEGORY_FILTERS, isCategoryId, type CategoryId } from "@/lib/category-filters";
import { isBookingTypeId } from "@/lib/booking-types";
import { PRICE_MIN, PRICE_MAX } from "@/lib/price-range";

// All URL search params ResourceSection's query can filter on. Every
// value is a raw string (or absent) since it comes straight off the URL;
// parsing and validation happen inside ResourceSection itself. Shared with
// app/page.tsx so the two stay in sync as filters are added, rather than
// each redeclaring the same shape.
export type BrowseSearchParams = {
  category?: string;
  tags?: string;
  city?: string;
  type?: string;
  priceMin?: string;
  priceMax?: string;
};

// The slow part of the browse page, isolated into its own component so
// app/page.tsx can wrap only this in Suspense. The sidebar and chip row
// render immediately regardless of how long this query takes.
export async function ResourceSection({ searchParams }: { searchParams: BrowseSearchParams }) {
  const {
    category: rawCategory,
    tags: rawTags,
    city,
    type: rawType,
    priceMin: rawPriceMin,
    priceMax: rawPriceMax,
  } = searchParams;

  const category: CategoryId = rawCategory && isCategoryId(rawCategory) ? rawCategory : "all";
  const selectedTags = rawTags ? rawTags.split(",").filter(Boolean) : [];
  const selectedTypes = rawType ? rawType.split(",").filter(isBookingTypeId) : [];
  const priceMin = rawPriceMin ? Number(rawPriceMin) : PRICE_MIN;
  const priceMax = rawPriceMax ? Number(rawPriceMax) : PRICE_MAX;

  // Category and tags can both resolve to a condition on Activity.tags,
  // for example category=gym maps to tag "Fitness" and tags=tennis maps
  // to tag "Tennis". They must go into an AND array rather than being
  // spread into one flat object, since two spreads that both set a tags
  // key would let the second silently overwrite the first.
  const activityConditions = [];
  if (category !== "all") activityConditions.push(CATEGORY_FILTERS[category]);
  if (selectedTags.length > 0) {
    activityConditions.push({
      tags: { some: { tag: { name: { in: selectedTags, mode: "insensitive" as const } } } },
    });
  }
  if (selectedTypes.length > 0) {
    activityConditions.push({ bookingMechanic: { in: selectedTypes } });
  }

  const resources = await prisma.resource.findMany({
    where: {
      activity: activityConditions.length > 0 ? { AND: activityConditions } : undefined,
      venue: city ? { city } : undefined,
      // PRICE_MAX is an open-ended "$100+" bound, so only the lower end
      // is enforced once the range reaches it.
      pricePerUnit: {
        gte: priceMin > PRICE_MIN ? priceMin : undefined,
        lte: priceMax < PRICE_MAX ? priceMax : undefined,
      },
    },
    include: {
      activity: { include: { tags: { include: { tag: true } } } },
      venue: true,
    },
    orderBy: { name: "asc" },
  });

  if (resources.length === 0) {
    return <p className="mt-10 text-sm text-muted-foreground">No results match these filters.</p>;
  }

  // Groups results by primary tag whenever they span more than one, so a
  // single homogeneous list stays flat while a mixed result set (several
  // tags selected, or a category spanning several tags such as "Courts
  // for hire" covering Tennis, Padel, and Football) breaks into labeled
  // sections. Section order comes from each tag's own displayOrder
  // column, fetched alongside the resource's activity.tags.tag relation.
  // Resources with no tag sort last under "Other".
  const groups = new Map<string, typeof resources>();
  const groupOrder = new Map<string, number>();
  for (const resource of resources) {
    const tag = getPrimaryTag(resource);
    const key = tag?.name ?? "Other";
    if (!groupOrder.has(key)) groupOrder.set(key, tag?.displayOrder ?? Infinity);
    const group = groups.get(key);
    if (group) {
      group.push(resource);
    } else {
      groups.set(key, [resource]);
    }
  }
  const groupNames = [...groups.keys()].sort(
    (a, b) => groupOrder.get(a)! - groupOrder.get(b)! || a.localeCompare(b)
  );

  if (groupNames.length <= 1) {
    return (
      <div className="mt-6">
        <ResourceGrid resources={resources} />
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-8">
      {groupNames.map((name) => (
        <section key={name}>
          <h2 className="mb-3 text-lg font-semibold">{name}</h2>
          <ResourceGrid resources={groups.get(name)!} />
        </section>
      ))}
    </div>
  );
}
