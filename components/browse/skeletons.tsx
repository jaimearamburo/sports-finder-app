import { cn } from "@/lib/utils";
import { CATEGORY_LABEL_TEXT_CLASS } from "@/components/browse/category-filter-list";
import { TAG_LABEL_TEXT_CLASS } from "@/components/browse/tag-filter-chips";
import {
  CARD_EYEBROW_TEXT_CLASS,
  CARD_TITLE_TEXT_CLASS,
  CARD_VENUE_TEXT_CLASS,
  CARD_META_TEXT_CLASS,
} from "@/components/browse/resource-card";

// CategoryFiltersSkeleton and TagFiltersSkeleton satisfy Next.js's
// requirement that any component calling useSearchParams() sits inside a
// Suspense boundary. They render almost instantly since there is no real
// data fetch behind them. ResourceGridSkeleton covers actual query time.

function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-foreground/10", className)} />;
}

// Sizes a text placeholder relative to the font size it is given instead
// of a fixed pixel height, so it tracks whatever text class is passed in.
// The wrapper uses flex, not inline-flex, so multiple instances stack as
// separate lines when rendered as siblings instead of sitting side by side.
function TextBone({ textClass, className }: { textClass: string; className?: string }) {
  return (
    <span className={cn(textClass, "flex items-center")}>
      <span className={cn("h-[0.85em] w-full animate-pulse rounded bg-foreground/10", className)} />
    </span>
  );
}

export function CategoryFiltersSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 5 }).map((_, i) => (
        // A button, not a div. Browsers apply default box model properties
        // to buttons that a CSS reset does not always fully zero out, so a
        // div with matching classes can still render a slightly different
        // height than the real button it stands in for.
        <button
          key={i}
          type="button"
          disabled
          className="border-l-2 border-transparent px-3 py-2 text-left"
        >
          <TextBone textClass={CATEGORY_LABEL_TEXT_CLASS} className="w-28" />
        </button>
      ))}
    </div>
  );
}

export function TagFiltersSkeleton() {
  return (
    <div className="mb-5 flex gap-5 overflow-x-auto pb-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <button
          key={i}
          type="button"
          disabled
          className="flex shrink-0 flex-col items-center gap-2.5 border-b-2 border-transparent pb-2.5"
        >
          <Bone className="size-20 rounded-[22%]" />
          <TextBone textClass={TAG_LABEL_TEXT_CLASS} className="w-12" />
        </button>
      ))}
    </div>
  );
}

function ResourceCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[5px] border border-t-[3px] border-t-transparent">
      <Bone className="h-32 rounded-none" />
      <div className="p-3.5">
        <TextBone textClass={CARD_EYEBROW_TEXT_CLASS} className="mb-1 w-16" />
        <TextBone textClass={CARD_TITLE_TEXT_CLASS} className="mb-1.5 w-32" />
        <TextBone textClass={CARD_VENUE_TEXT_CLASS} className="mb-2.5 w-36" />
        <div className="flex items-baseline justify-between">
          <TextBone textClass={CARD_META_TEXT_CLASS} className="w-16" />
          <TextBone textClass={CARD_META_TEXT_CLASS} className="w-10" />
        </div>
      </div>
    </div>
  );
}

export function ResourceGridSkeleton() {
  // Two grouped sections, matching the shape of the default (unfiltered)
  // browse view, which groups results by tag.
  return (
    <div className="mt-6 flex flex-col gap-8">
      {[0, 1].map((section) => (
        <div key={section}>
          <TextBone textClass="text-lg font-semibold" className="mb-3 w-24" />
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
