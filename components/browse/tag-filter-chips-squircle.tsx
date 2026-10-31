"use client";

// Alternative TagFilterChips using a true squircle clip path. Not imported
// anywhere; a visual reference only.
import { startTransition, useOptimistic } from "react";
import { getSvgPath } from "figma-squircle";
import { cn } from "@/lib/utils";
import { TAG_LABEL_TEXT_CLASS } from "@/lib/label-styles";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

type BrowseTag = { id: string; name: string; emoji: string; color: string };

// A continuous-curve squircle (Figma's corner smoothing), computed once.
// ICON_SIZE sizes both the clip path and the icon.
const ICON_SIZE = 80;
const SQUIRCLE_CLIP_PATH = `path('${getSvgPath({
  width: ICON_SIZE,
  height: ICON_SIZE,
  cornerRadius: 22,
  cornerSmoothing: 1,
})}')`;

// Renders the chips without URL logic; TagFilters passes a callback. Owns the
// optimistic display and pending state.
export function TagFilterChips({
  tags,
  selected,
  changeAction,
}: {
  tags: BrowseTag[];
  selected: Set<string>;
  changeAction: (next: Set<string>) => void;
}) {
  // Optimistic selection and pending flag, applied on the current frame so a
  // clicked chip highlights immediately.
  const [optimisticSelected, setOptimisticSelected] = useOptimistic(selected);
  const [isPending, setIsPending] = useOptimistic(false);

  function handleClick(name: string) {
    const slug = name.toLowerCase();
    // From the optimistic state, so a second quick click toggles correctly.
    const next = new Set(optimisticSelected);
    if (next.has(slug)) {
      next.delete(slug);
    } else {
      next.add(slug);
    }

    startTransition(() => {
      setOptimisticSelected(next);
      setIsPending(true);
      changeAction(next);
    });
  }

  return (
    // ScrollArea's Viewport scrolls the row, for its custom thumb
    // (components/ui/scroll-area.tsx).
    <ScrollArea
      className="-mt-2 -mr-2 -ml-2 mb-2 sm:mb-5"
      // The edge fade hints the row scrolls. On the Viewport, not the content,
      // so it fades the visible edge.
      viewportClassName="mask-[linear-gradient(to_right,black_calc(100%-56px),transparent_100%)]"
    >
      <div
        className="flex gap-4 pt-1 pr-2 pb-0.5 pl-2 sm:pt-2 sm:pb-1"
        data-pending={isPending ? "" : undefined}
      >
        {tags.map((tag) => {
          const isSelected = optimisticSelected.has(tag.name.toLowerCase());

          return (
            <div key={tag.id} className="flex shrink-0 flex-col items-center gap-1 pb-1 sm:gap-2.5 sm:pb-2.5">
              <button
                type="button"
                onClick={() => handleClick(tag.name)}
                aria-pressed={isSelected}
                aria-label={tag.name}
                // Named group ("chip") so group-hover doesn't react to other
                // groups on the page. Only the icon is inside the button.
                // active:scale-95 gives tap feedback.
                className="group/chip transition-transform duration-150 active:scale-95"
              >
                {/* drop-shadow on a wrapper: on the clipped element itself,
                    clip-path would cut the shadow off. drop-shadow-md stays
                    visible on the near-white tile. translateZ(0) works around a
                    WebKit bug where a filter around a clip-path'd child doesn't
                    paint. */}
                <span className="drop-shadow-md transform-[translateZ(0)]">
                  {/* Tag colours are data, so they come from an inline style.
                      The clip path clips the contents; width and height come
                      from ICON_SIZE so the box matches it. */}
                  <span
                    className={cn(
                      "relative flex items-center justify-center",
                      // Off-white, lighter than the lightest gray-* step.
                      !isSelected && "bg-[#fcfcfc]"
                    )}
                    style={{
                      width: ICON_SIZE,
                      height: ICON_SIZE,
                      clipPath: SQUIRCLE_CLIP_PATH,
                      ...(isSelected ? { backgroundColor: tag.color } : {}),
                    }}
                  >
                    <span className="relative inline-block text-2xl leading-none transition-transform duration-150 group-hover/chip:scale-[1.4]">
                      {tag.emoji}
                    </span>
                  </span>
                </span>
              </button>
              <span className={cn(TAG_LABEL_TEXT_CLASS, isSelected ? "text-foreground" : "text-muted-foreground")}>
                {tag.name}
              </span>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
