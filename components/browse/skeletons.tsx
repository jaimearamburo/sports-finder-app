import { cn } from "@/lib/utils";
import { CATEGORY_LABEL_TEXT_CLASS, TAG_LABEL_TEXT_CLASS } from "@/lib/label-styles";
import {
  CARD_EYEBROW_TEXT_CLASS,
  CARD_TITLE_TEXT_CLASS,
  CARD_VENUE_TEXT_CLASS,
  CARD_LOCATION_TEXT_CLASS,
  CARD_META_TEXT_CLASS,
} from "@/components/browse/listing-card";

// BrowseSidebarSkeleton and TagFiltersSkeleton satisfy Next.js's
// requirement that any component calling useSearchParams() sits inside a
// Suspense boundary. They render almost instantly since there is no real
// data fetch behind them. ListingGridSkeleton covers actual query time.

function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-foreground/10", className)} />;
}

// Sizes a text placeholder relative to the font size it is given instead
// of a fixed pixel height, so it tracks whatever text class is passed in.
// The outer span carries the text class with no display override, so its
// height comes from normal line-box layout (governed by line-height),
// matching real text exactly. The inner bone is inline-block with
// align-middle so it participates in that same line box instead of
// forming its own flex layout, which would size itself independently of
// line-height and end up shorter than the real text it stands in for.
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

// Pill-shaped bones (city, 4 categories, price) matching MobileFilterBar's
// own row shape, so the loading placeholder doesn't visibly resize once
// the real pills (which vary in width by label) take its place.
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
          // A button, not a div. Browsers apply default box model properties
          // to buttons that a CSS reset does not always fully zero out, so a
          // div with matching classes can still render a slightly different
          // height than the real button it stands in for.
          <button
            key={i}
            type="button"
            disabled
            className={cn("border-l-2 border-transparent px-2.5 py-2 text-left", CATEGORY_LABEL_TEXT_CLASS)}
          >
            {/* text-sm font-medium on the button itself, not just the
                bone inside it, so its line box uses that line-height
                rather than a taller default one. */}
            <TextBone textClass={CATEGORY_LABEL_TEXT_CLASS} className="w-28" />
          </button>
        ))}
      </div>
    </div>
  );
}

// Mirrors tag-filter-chips.tsx's own two-level structure (an outer
// negative-margin wrapper around an inner padded row) rather than one
// flattened div with approximate spacing - the real component's negative
// margin on the outer edge and padding on the inner row only cancel out
// to the right net position together, so matching just one of the two
// still leaves a visible jump when the real row swaps in.
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
      <Bone className="h-20 rounded-none sm:h-28 md:h-32" />
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

// Two grouped sections, matching the shape of the browse view
// (ListingGrid), which wraps into as many rows as fit.
export function ListingGridSkeleton() {
  return (
    <div className="mt-6 flex flex-col gap-8">
      {[0, 1].map((section) => (
        <div key={section}>
          <TextBone textClass="text-lg font-semibold" className="mb-3 w-24" />
          {/* Same track as ListingGrid (2 stretchy columns on mobile,
              then a flat per-breakpoint auto-fill track) - keeps the
              loading placeholder the same shape and size as the real
              card that replaces it at every width. */}
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
