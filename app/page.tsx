import { prisma } from "@/lib/prisma";
import { CategoryNav } from "@/components/browse/category-nav";
import { SidebarFilters } from "@/components/browse/sidebar-filters";
import { TagChipRow } from "@/components/browse/tag-chip-row";
import { FilterBar } from "@/components/browse/filter-bar";
import { ResourceGrid, getPrimaryTagName } from "@/components/browse/resource-card";
import { CATEGORY_FILTERS, TAG_ORDER, isCategoryId } from "@/lib/browse-filters";

// This is the browse/landing page, the data
// fetch and the filter UI can't really be designed separately since both
// have to agree on the same URL contract). Every filter control writes to
// the URL instead of local state; this Server Component reads
// `searchParams` and re-queries on every change.
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; tags?: string }>;
}) {
  // Extract params from url
  const params = await searchParams;
  const category = params.category && isCategoryId(params.category) ? params.category : "all";
  const selectedTags = params.tags ? params.tags.split(",").filter(Boolean) : [];

  // Category and tags can both resolve to a condition on Activity.tags
  // (e.g. category=gym → tag "Fitness", tags=tennis → tag "Tennis"). They
  // must go into an `AND` array, not be spread into one flat object.
  const activityConditions = [];
  if (category !== "all") activityConditions.push(CATEGORY_FILTERS[category]);

  //
  if (selectedTags.length > 0) {
    activityConditions.push({
      tags: { some: { tag: { name: { in: selectedTags, mode: "insensitive" as const } } } },
    });
  }

  const [dbTags, resources] = await Promise.all([
    prisma.tag.findMany(),
    prisma.resource.findMany({
      where: {
        activity: activityConditions.length > 0 ? { AND: activityConditions } : undefined,
      },
      include: {
        activity: { include: { tags: { include: { tag: true } } } },
        venue: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  // TAG_ORDER (Tennis, Classes, Fitness, Football, Padel, Camping) is the
  // curated display order — the database has no ordering column, and
  // fetching pre-sorted by name would give an alphabetical row instead.
  // ********************************************
  // TODO: make sorting order be database driven
  const tags = [...dbTags].sort((a, b) => TAG_ORDER.indexOf(a.name) - TAG_ORDER.indexOf(b.name));

  // Group by primary tag whenever the current results span more than one.
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
  const isGrouped = groupNames.length > 1;

  return (
    <div className="mx-auto grid w-full max-w-[1800px] grid-cols-[240px_minmax(0,1fr)] gap-8 px-4 py-7 sm:px-6 lg:px-8">
      <aside>
        <CategoryNav />
        <SidebarFilters />
      </aside>

      <main>
        <TagChipRow tags={tags} />
        <FilterBar />

        {resources.length === 0 ? (
          <p className="mt-10 text-sm text-muted-foreground">No results match these filters.</p>
        ) : isGrouped ? (
          <div className="mt-6 flex flex-col gap-8">
            {groupNames.map((name) => (
              <section key={name}>
                <h2 className="mb-3 text-lg font-semibold">{name}</h2>
                <ResourceGrid resources={groups.get(name)!} />
              </section>
            ))}
          </div>
        ) : (
          <div className="mt-6">
            <ResourceGrid resources={resources} />
          </div>
        )}
      </main>
    </div>
  );
}
