import { cn } from "@/lib/utils";

// Two different jobs, both called "skeleton": CategoryNavSkeleton and
// TagChipRowSkeleton cover the Suspense boundaries that exist only to
// satisfy Next.js's "useSearchParams() needs a Suspense ancestor"
// requirement (see category-nav.tsx / tag-chip-row.tsx). ResourceGridSkeleton
// covers real query latency.

function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-foreground/10", className)} />;
}

export function CategoryNavSkeleton() {
  return (
    <div className="flex flex-col gap-2 py-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Bone key={i} className="h-5 w-28" />
      ))}
    </div>
  );
}

export function TagChipRowSkeleton() {
  return (
    <div className="mb-5 flex gap-5 overflow-x-auto pb-1">
      {Array.from({ length: 6 }).map((_, i) => (
        // Matches TagChipGroup's real button structure exactly (same
        // border-b-2/pb-2.5 on the wrapper, same size-20/rounded-[22%] icon)
        // — the real chips otherwise render slightly taller than this
        // skeleton did, which showed up as the whole page shifting down
        // the moment real content replaced it.
        <div key={i} className="flex shrink-0 flex-col items-center gap-2.5 border-b-2 border-transparent pb-2.5">
          <Bone className="size-20 rounded-[22%]" />
          <Bone className="h-3.5 w-12" />
        </div>
      ))}
    </div>
  );
}

function ResourceCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[5px] border border-t-[3px] border-t-transparent">
      <Bone className="h-32 rounded-none" />
      <div className="p-3.5">
        <Bone className="mb-1 h-3 w-16" />
        <Bone className="mb-1.5 h-[1.05rem] w-32" />
        <Bone className="mb-2.5 h-3.5 w-36" />
        <div className="flex items-baseline justify-between">
          <Bone className="h-3.5 w-16" />
          <Bone className="h-3.5 w-10" />
        </div>
      </div>
    </div>
  );
}

export function ResourceGridSkeleton() {
  // 
  return (
    <div className="mt-6 flex flex-col gap-8">
      {[0, 1].map((section) => (
        <div key={section}>
          <Bone className="mb-3 h-[1.125rem] w-24" />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <ResourceCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
