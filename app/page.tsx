import { Suspense } from "react";
import { BrowseSidebar } from "@/components/browse/browse-sidebar";
import { TagFilters } from "@/components/browse/tag-filters";
import { QuickFilters } from "@/components/browse/quick-filters";
import { ResourceSection, type BrowseSearchParams } from "@/components/browse/resource-section";
import { BrowseSidebarSkeleton, TagFiltersSkeleton, ResourceGridSkeleton } from "@/components/browse/skeletons";
import { getBrowseTags } from "@/lib/browse-tags";
import { getBrowseCities } from "@/lib/browse-cities";

// Small async wrapper so the cached tags fetch lives inside its own
// Suspense boundary rather than blocking the rest of the page.
async function TagFilterSection() {
  const tags = await getBrowseTags();
  return <TagFilters tags={tags} />;
}

// Small async wrapper so the cached cities fetch lives inside its own
// Suspense boundary rather than blocking the rest of the page.
async function BrowseSidebarSection() {
  const cities = await getBrowseCities();
  return <BrowseSidebar cities={cities} />;
}

// The browse and landing page. Every filter control writes to the URL
// instead of local state. Data fetching lives in separate components
// (BrowseSidebarSection, TagFilterSection, ResourceSection), each wrapped
// in Suspense so the sidebar and chip row render immediately regardless of
// how long the resources query takes.
export default function Home({
  searchParams,
}: {
  searchParams: Promise<BrowseSearchParams>;
}) {
  return (
    <div className="group/browse mx-auto grid w-full max-w-[1800px] grid-cols-[200px_minmax(0,1fr)] gap-8 px-4 sm:px-6 lg:px-8">
      {/* Grid items stretch to fill their row's height by default, and a
          sticky element already stretched to the full row has no room to
          actually stick as the page scrolls. self-start sizes this to its
          own content instead. top-17.25 is SiteHeader's h-17 (68px) plus
          its border-b (1px) - the header's true rendered height, not just
          its inner content div's. Using top-17 alone locks the sidebar 1px
          early relative to the header's actual bottom edge, drifting by
          that 1px on every scroll before it catches the lock. py-7 lives
          on main, not here, so the sidebar sits flush against the header
          from the very top of the page. */}
      <aside className="sticky top-17.25 self-start py-7">
        <Suspense fallback={<BrowseSidebarSkeleton />}>
          <BrowseSidebarSection />
        </Suspense>
      </aside>

      <main className="py-7">
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
            {searchParams.then((params) => (
              <ResourceSection searchParams={params} />
            ))}
          </Suspense>
        </div>
      </main>
    </div>
  );
}
