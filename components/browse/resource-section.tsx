import { prisma } from "@/lib/prisma";
import { ResourceGrid, getPrimaryTagName } from "@/components/browse/resource-card";
import { CATEGORY_FILTERS, TAG_ORDER, isCategoryId, type CategoryId } from "@/lib/browse-filters";

// The slow part of the browse page, isolated into its own component so
// app/page.tsx can wrap only this in <Suspense> — the sidebar and chip
// row render immediately regardless of how long this query takes. See
// app/page.tsx for how this gets fed a promise via searchParams.then(...)
// rather than being awaited at the page's top level.
export async function ResourceSection({
  category: rawCategory,
  tags: rawTags,
}: {
  category?: string;
  tags?: string;
}) {
  const category: CategoryId = rawCategory && isCategoryId(rawCategory) ? rawCategory : "all";
  const selectedTags = rawTags ? rawTags.split(",").filter(Boolean) : [];

  // Category and tags can both resolve to a condition on Activity.tags
  // (e.g. category=gym → tag "Fitness", tags=tennis → tag "Tennis"). They
  // must go into an `AND` array, not be spread into one flat object — two
  // spreads that both set a `tags` key would silently let the second
  // overwrite the first instead of combining.
  const activityConditions = [];
  if (category !== "all") activityConditions.push(CATEGORY_FILTERS[category]);
  if (selectedTags.length > 0) {
    activityConditions.push({
      tags: { some: { tag: { name: { in: selectedTags, mode: "insensitive" as const } } } },
    });
  }

  const resources = await prisma.resource.findMany({
    where: {
      activity: activityConditions.length > 0 ? { AND: activityConditions } : undefined,
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

  // Group by primary tag whenever the current results span more than one
  // — not tied to which filters happen to be active. One tag selected (or
  // a category that only ever resolves to one tag) already reads as a
  // single, homogeneous list, so a lone section header would just be
  // noise; several tags selected, or a category spanning several tags
  // (e.g. "Courts for hire" = Tennis + Padel + Football), reads better
  // broken into sections than as one undifferentiated grid.
  const groups = new Map<string, typeof resources>();
  for (const resource of resources) {
    const key = getPrimaryTagName(resource) ?? "Other";
    const group = groups.get(key);
    if (group) {
      group.push(resource);
    } else {
      groups.set(key, [resource]);
    }
  }
  const groupNames = [...groups.keys()].sort(
    (a, b) => TAG_ORDER.indexOf(a) - TAG_ORDER.indexOf(b)
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
