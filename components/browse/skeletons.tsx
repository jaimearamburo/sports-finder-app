import { cn } from "@/lib/utils";
import { Skeleton as Bone } from "@/components/ui/skeleton";
import { CATEGORY_LABEL_TEXT_CLASS, TAG_LABEL_TEXT_CLASS } from "@/lib/label-styles";
import {
  CARD_IMAGE_AREA_CLASS,
  CARD_EYEBROW_TEXT_CLASS,
  CARD_TITLE_TEXT_CLASS,
  CARD_VENUE_TEXT_CLASS,
  CARD_LOCATION_TEXT_CLASS,
  CARD_META_TEXT_CLASS,
} from "@/components/browse/listing-card";

// The sidebar and tag skeletons satisfy Next.js's Suspense requirement for
// useSearchParams and render almost instantly; ListingGridSkeleton covers the
// real query.

// A text placeholder sized by the given text class's line box: the outer span
// takes its height from line-height, and the inline-block bone sits in that
// line, so it's as tall as real text.
function TextBone({
  as: Tag = "span",
  textClass,
  className,
}: {
  as?: "span" | "p";
  textClass: string;
  className?: string;
}) {
  return (
    <Tag className={textClass}>
      <span
        className={cn(
          "inline-block h-[0.85em] w-full animate-pulse rounded bg-foreground/10 align-middle",
          className
        )}
      />
    </Tag>
  );
}

// Pill bones matching MobileFilterBar's row, so nothing resizes when the real
// pills arrive.
export function MobileFilterBarSkeleton() {
  return (
    <div className="-mt-2 -mr-2 -ml-2 mb-3 flex gap-1.5 overflow-hidden px-2 py-1">
      <Bone className="h-9 w-28 shrink-0 rounded-md" />
      <Bone className="h-9 w-16 shrink-0 rounded-md" />
      <Bone className="h-9 w-28 shrink-0 rounded-md" />
      <Bone className="h-9 w-28 shrink-0 rounded-md" />
    </div>
  );
}

export function BrowseSidebarSkeleton() {
  return (
    <div>
      <div className="flex flex-col">
        {Array.from({ length: 4 }).map((_, i) => (
          // A button, not a div: browser button defaults can change its height,
          // so the bone matches the real button exactly.
          <button
            key={i}
            type="button"
            disabled
            className={cn("border-l-2 border-transparent px-2.5 py-2 text-left", CATEGORY_LABEL_TEXT_CLASS)}
          >
            {/* Text classes on the button so its line box matches. */}
            <TextBone textClass={CATEGORY_LABEL_TEXT_CLASS} className="w-28" />
          </button>
        ))}
      </div>
    </div>
  );
}

// Mirrors TagFilterChips' outer negative-margin wrapper and padded inner row;
// both are needed for the row to land in the same place.
export function TagFiltersSkeleton() {
  return (
    <div className="-mt-2 -mr-2 -ml-2 mb-2 sm:mb-5">
      <div className="flex gap-4 overflow-x-auto pt-1 pr-2 pb-0.5 pl-2 sm:pt-2 sm:pb-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex shrink-0 flex-col items-center gap-1 pb-1 sm:gap-2.5 sm:pb-2.5">
            <button type="button" disabled>
              <Bone className="size-20 rounded-[22%]" />
            </button>
            <TextBone textClass={TAG_LABEL_TEXT_CLASS} className="w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[5px] border border-t-[3px] border-t-transparent">
      <Bone className={cn("rounded-none", CARD_IMAGE_AREA_CLASS)} />
      <div className="p-2.5 sm:p-3.5">
        <TextBone as="p" textClass={CARD_EYEBROW_TEXT_CLASS} className="mb-1 hidden w-16 sm:block" />
        <TextBone as="p" textClass={CARD_TITLE_TEXT_CLASS} className="mb-1.5 w-32" />
        <TextBone as="p" textClass={CARD_VENUE_TEXT_CLASS} className="w-36" />
        <TextBone as="p" textClass={CARD_LOCATION_TEXT_CLASS} className="mb-2.5 w-20" />
        <div className="flex items-baseline justify-between">
          <TextBone textClass={CARD_META_TEXT_CLASS} className="w-16" />
          <TextBone textClass={CARD_META_TEXT_CLASS} className="w-10" />
        </div>
      </div>
    </div>
  );
}

// Two grouped sections, like ListingGrid.
export function ListingGridSkeleton() {
  return (
    <div className="mt-6 flex flex-col gap-8">
      {[0, 1].map((section) => (
        <div key={section}>
          <TextBone textClass="text-lg font-semibold" className="mb-3 w-24" />
          {/* Same tracks as ListingGrid, so placeholders match the real cards
              at every width. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,180px)] sm:gap-4 md:grid-cols-[repeat(auto-fill,220px)]">
            {Array.from({ length: 4 }).map((_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
