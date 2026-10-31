import { Suspense } from "react";
import { BrowseSidebar } from "@/components/browse/browse-sidebar";
import { MobileFilterBar } from "@/components/browse/mobile-filter-bar";
import { BrowsePageShell } from "@/components/browse/browse-page-shell";
import { FloatingButtons } from "@/components/browse/floating-buttons";
import { TagFilters } from "@/components/browse/tag-filters";
import { QuickFilters } from "@/components/browse/quick-filters";
import { SearchInterpretation } from "@/components/browse/search-interpretation";
import { PendingResults } from "@/components/browse/pending-results";
import { ListingSection, type BrowseSearchParams } from "@/components/browse/listing-section";
import {
  BrowseSidebarSkeleton,
  MobileFilterBarSkeleton,
  TagFiltersSkeleton,
  ListingGridSkeleton,
} from "@/components/browse/skeletons";
import { getBrowseTags } from "@/lib/browse-tags";
import { getBrowseCities } from "@/lib/browse-cities";

// Its own Suspense boundary, so the tags don't block the page.
async function TagFilterSection() {
  const tags = await getBrowseTags();
  return <TagFilters tags={tags} />;
}

// Its own Suspense boundary, so the cities don't block the page.
async function BrowseSidebarSection() {
  const cities = await getBrowseCities();
  return <BrowseSidebar cities={cities} />;
}

// The mobile pill row's cities. getBrowseCities is wrapped in React's cache(),
// so this and BrowseSidebarSection share one query per request.
async function MobileFilterBarSection() {
  const cities = await getBrowseCities();
  return <MobileFilterBar cities={cities} />;
}

// The browse and landing page. Every filter lives in the URL. Data loads in
// Suspense-wrapped sections (sidebar, tag chips, listings), so the filters
// render while the listings query runs.
export default function Home({
  searchParams,
}: {
  searchParams: Promise<BrowseSearchParams>;
}) {
  return (
    <div>
      {/* Screen-reader-only h1: browse has no visible title, but screen-reader
          users navigate by headings. */}
      <h1 className="sr-only">Browse activities</h1>
      <BrowsePageShell
        sidebar={
          <Suspense fallback={<BrowseSidebarSkeleton />}>
            <BrowseSidebarSection />
          </Suspense>
        }
      >
        {/* Phones only: the sidebar's filters as a pill row above the tag
            chips. */}
        <div className="md:hidden">
          <Suspense fallback={<MobileFilterBarSkeleton />}>
            <MobileFilterBarSection />
          </Suspense>
        </div>

        <Suspense fallback={<TagFiltersSkeleton />}>
          <TagFilterSection />
        </Suspense>
        <QuickFilters />
        <SearchInterpretation />

        {/* No key on the Suspense below: a keyed boundary would show its
            fallback on every change, while an unkeyed one keeps the old results
            visible (dimmed by PendingResults) during a transition. */}
        <PendingResults>
          <Suspense fallback={<ListingGridSkeleton />}>
            {searchParams.then((params) => (
              <ListingSection searchParams={params} />
            ))}
          </Suspense>
        </PendingResults>
      </BrowsePageShell>
      <FloatingButtons />
    </div>
  );
}
