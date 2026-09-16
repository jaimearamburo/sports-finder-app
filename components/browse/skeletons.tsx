import { cn } from "@/lib/utils";
import { CATEGORY_LABEL_TEXT_CLASS, TAG_LABEL_TEXT_CLASS } from "@/lib/label-styles";
import {
  CARD_EYEBROW_TEXT_CLASS,
  CARD_TITLE_TEXT_CLASS,
  CARD_VENUE_TEXT_CLASS,
  CARD_META_TEXT_CLASS,
} from "@/components/browse/resource-card";

// BrowseSidebarSkeleton and TagFiltersSkeleton satisfy Next.js's
// requirement that any component calling useSearchParams() sits inside a
// Suspense boundary. They render almost instantly since there is no real
// data fetch behind them. ResourceGridSkeleton covers actual query time.

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

export function BrowseSidebarSkeleton() {
  return (
    <div>
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
            className={cn("border-l-2 border-transparent px-2.5 py-2 text-left", CATEGORY_LABEL_TEXT_CLASS)}
          >
            {/* text-sm font-medium on the button itself, not just the
                bone inside it, so its line box uses that line-height
                rather than a taller default one. */}
            <TextBone textClass={CATEGORY_LABEL_TEXT_CLASS} className="w-28" />
          </button>
        ))}
      </div>

      {/* <div className="mt-6 flex flex-col gap-6">
        <div className="border-t pt-4">
          <Bone className="mb-3 h-3 w-12" />
          <Bone className="h-9 w-full rounded-md" />
        </div>
        <div className="border-t pt-4">
          <Bone className="mb-3 h-3 w-16" />
          <div className="mb-3 flex justify-between">
            <Bone className="h-3 w-6" />
            <Bone className="h-3 w-8" />
          </div>
          <Bone className="h-1.5 w-full rounded-full" />
        </div>
        <div className="border-t pt-4">
          <Bone className="mb-3 h-3 w-20" />
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Bone key={i} className="h-3.75 w-24" />
            ))}
          </div>
        </div>
      </div> */}
    </div>
  );
}

export function TagFiltersSkeleton() {
  return (
    <div className="mb-5 flex gap-4 overflow-x-auto pb-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex shrink-0 flex-col items-center gap-2.5 pb-2.5">
          <button type="button" disabled>
            <Bone className="size-20 rounded-[22%]" />
          </button>
          <TextBone textClass={TAG_LABEL_TEXT_CLASS} className="w-12" />
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
        <TextBone as="p" textClass={CARD_EYEBROW_TEXT_CLASS} className="mb-1 w-16" />
        <TextBone as="p" textClass={CARD_TITLE_TEXT_CLASS} className="mb-1.5 w-32" />
        <TextBone as="p" textClass={CARD_VENUE_TEXT_CLASS} className="mb-2.5 w-36" />
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
