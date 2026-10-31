import { Skeleton } from "@/components/ui/skeleton";

// Shown while the listing page loads. The real card outline: bordered white
// card, a still tinted photo area in the photo's shape, and three pulsing lines
// for activity, name and venue.
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
