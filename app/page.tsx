import { Suspense } from "react";
import { CategoryFilters } from "@/components/browse/category-filters";
import { SidebarFilters } from "@/components/browse/sidebar-filters";
import { TagFilters } from "@/components/browse/tag-filters";
import { QuickFilters } from "@/components/browse/quick-filters";
import { ResourceSection } from "@/components/browse/resource-section";
import { CategoryFiltersSkeleton, TagFiltersSkeleton, ResourceGridSkeleton } from "@/components/browse/skeletons";
import { getBrowseTags } from "@/lib/browse-tags";

// Small async wrapper so the cached tags fetch lives inside its own
// Suspense boundary rather than blocking the rest of the page.
async function TagFilterSection() {
  const tags = await getBrowseTags();
  return <TagFilters tags={tags} />;
}

// The browse and landing page. Every filter control writes to the URL
// instead of local state. Data fetching lives in separate components
// (TagFilterSection, ResourceSection), each wrapped in Suspense so the
// sidebar and chip row render immediately regardless of how long the
// resources query takes.
export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; tags?: string }>;
}) {
  return (
    <div className="group/browse mx-auto grid w-full max-w-[1800px] grid-cols-[240px_minmax(0,1fr)] gap-8 px-4 py-7 sm:px-6 lg:px-8">
      {/* Grid items stretch to fill their row's height by default, and a
          sticky element already stretched to the full row has no room to
          actually stick as the page scrolls. self-start sizes this to its
          own content instead. top-17 matches SiteHeader's h-17 so this
          sticks directly below the sticky header. */}
      <aside className="sticky top-17 self-start">
        <Suspense fallback={<CategoryFiltersSkeleton />}>
          <CategoryFilters />
        </Suspense>
        <SidebarFilters />
      </aside>

      <main>
        <Suspense fallback={<TagFiltersSkeleton />}>
          <TagFilterSection />
        </Suspense>
        <QuickFilters />

        {/* No key on the Suspense below. A keyed boundary remounts on
            every change and always shows its fallback again; leaving it
            unkeyed lets a transition-wrapped filter change keep the
            existing results visible, dimmed and blurred through
            data-pending, while the new ones load. */}
        <div className="group-has-data-pending/browse:blur-[1px] group-has-data-pending/browse:opacity-30 transition-[filter,opacity] duration-200">
          <Suspense fallback={<ResourceGridSkeleton />}>
            {searchParams.then(({ category, tags }) => (
              <ResourceSection category={category} tags={tags} />
            ))}
          </Suspense>
        </div>
      </main>
    </div>
  );
}
