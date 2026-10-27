import { Skeleton } from "@/components/ui/skeleton";

// Shown while the listing detail page loads (listing, bookable dates,
// active hold, occupancy - all awaited before it can render). Deliberately
// minimal rather than a replica of the page: one box where "Go back" sits
// and one block for everything below, inside the page's own container so
// nothing shifts sideways when the real content arrives.
export default function ListingLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-7 sm:px-6">
      <Skeleton className="h-5 w-20" />
      <Skeleton className="mt-4 h-128 w-full rounded-md" />
    </div>
  );
}
