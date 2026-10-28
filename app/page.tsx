import { Suspense } from "react";
import { BrowseSidebar } from "@/components/browse/browse-sidebar";
import { MobileFilterBar } from "@/components/browse/mobile-filter-bar";
import { BrowsePageShell } from "@/components/browse/browse-page-shell";
import { BackToTopButton } from "@/components/browse/back-to-top-button";
import { TagFilters } from "@/components/browse/tag-filters";
import { QuickFilters } from "@/components/browse/quick-filters";
import { ListingSection, type BrowseSearchParams } from "@/components/browse/listing-section";
import {
  BrowseSidebarSkeleton,
  MobileFilterBarSkeleton,
  TagFiltersSkeleton,
  ListingGridSkeleton,
} from "@/components/browse/skeletons";
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

// Mirrors BrowseSidebarSection for the mobile pill row. Calling
// getBrowseCities() again here rather than hoisting the fetch up to Home
// itself lets each piece stream in independently; getBrowseCities() is
// wrapped in React's cache() specifically so this and
// BrowseSidebarSection never trigger two real queries in one request.
async function MobileFilterBarSection() {
  const cities = await getBrowseCities();
  return <MobileFilterBar cities={cities} />;
}

// The browse and landing page. Every filter control writes to the URL
// instead of local state. Data fetching lives in separate components
// (BrowseSidebarSection, TagFilterSection, ListingSection), each wrapped
// in Suspense so the sidebar and chip row render immediately regardless of
// how long the listings query takes.
export default function Home({
  searchParams,
}: {
  searchParams: Promise<BrowseSearchParams>;
}) {
  return (
    <div className="group/browse">
      {/* Screen-reader-only page heading: the browse layout has no visible
          title (the filters and listings speak for themselves visually),
          but screen-reader users navigate by headings and need an h1 to
          land on. */}
      <h1 className="sr-only">Browse activities</h1>
      <BrowsePageShell
        sidebar={
          <Suspense fallback={<BrowseSidebarSkeleton />}>
            <BrowseSidebarSection />
          </Suspense>
        }
      >
        {/* Mobile-only (see BrowsePageShell / MobileFilterBar) -
            the sidebar's own filters as a pill row, shown above the tag
            chips since it's the first narrowing step, same as the tag
            chips are the first thing under it. */}
        <div className="md:hidden">
          <Suspense fallback={<MobileFilterBarSkeleton />}>
            <MobileFilterBarSection />
          </Suspense>
        </div>

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
          <Suspense fallback={<ListingGridSkeleton />}>
            {searchParams.then((params) => (
              <ListingSection searchParams={params} />
            ))}
          </Suspense>
        </div>
      </BrowsePageShell>
      <BackToTopButton />
    </div>
  );
}
