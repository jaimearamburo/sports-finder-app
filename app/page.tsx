import { Suspense } from "react";
import { CategoryNav } from "@/components/browse/category-nav";
import { SidebarFilters } from "@/components/browse/sidebar-filters";
import { TagChipRow } from "@/components/browse/tag-chip-row";
import { FilterBar } from "@/components/browse/filter-bar";
import { ResourceSection } from "@/components/browse/resource-section";
import { CategoryNavSkeleton, TagChipRowSkeleton, ResourceGridSkeleton } from "@/components/browse/skeletons";
import { getBrowseTags } from "@/lib/browse-tags";

// Small async wrapper so the (cached) tags fetch lives inside its own
// Suspense boundary rather than blocking the rest of the page.
async function TagFilterSection() {
  const tags = await getBrowseTags();
  return <TagChipRow tags={tags} />;
}

// This is the browse/landing page. Every filter control writes to the
// URL instead of local state; the actual data-fetching lives in separate
// components (TagFilterSection, ResourceSection).
export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; tags?: string }>;
}) {
  return (
    <div className="group/browse mx-auto grid w-full max-w-[1800px] grid-cols-[240px_minmax(0,1fr)] gap-8 px-4 py-7 sm:px-6 lg:px-8">
      <aside>
        <Suspense fallback={<CategoryNavSkeleton />}>
          <CategoryNav />
        </Suspense>
        <SidebarFilters />
      </aside>

      <main>
        <Suspense fallback={<TagChipRowSkeleton />}>
          <TagFilterSection />
        </Suspense>
        <FilterBar />

        {/* Results grid, skipped adding a key on the
          Suspense below so that we can add a dimming or blurring effect when 
          loading new data when filters change - Suspense doesn't drop the contents if no key is set */}
        <div className="group-has-data-pending/browse:opacity-30 transition-opacity">
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
