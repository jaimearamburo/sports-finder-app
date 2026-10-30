import { Skeleton } from "@/components/ui/skeleton";

// Shown while the listing detail page loads (listing, bookable dates,
// active hold, occupancy - all awaited before it can render). The real
// page's card outline rather than one big grey block: the same bordered
// white card, its photo area in the shape the photo will have (a calm,
// still tint, like the page's own frame before a photo loads), and three
// short pulsing lines where the activity, name and venue go. Deliberately
// no more than that - not a replica of the booking section below.
export default function ListingLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-7 sm:px-6">
      <Skeleton className="h-5 w-20" />
      <div className="mt-4 overflow-hidden rounded-md border bg-card shadow-sm">
        <div className="aspect-[3/2] border-t-[3px] border-t-muted bg-muted/60 sm:aspect-[2/1]" />
        <div className="flex flex-col gap-2.5 p-6">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-7 w-56 max-w-full" />
          <Skeleton className="h-5 w-44 max-w-full" />
        </div>
      </div>
    </div>
  );
}
