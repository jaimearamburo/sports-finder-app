"use client";

import { cn } from "@/lib/utils";
import { TAG_LABEL_TEXT_CLASS } from "@/lib/label-styles";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

type BrowseTag = { id: string; name: string; emoji: string; color: string };

// Renders the chips without URL logic; TagFilters passes a callback. `selected`
// includes a change still loading (useBrowseFilters), so clicks highlight
// immediately and quick clicks build on each other.
export function TagFilterChips({
  tags,
  selected,
  changeAction,
}: {
  tags: BrowseTag[];
  selected: Set<string>;
  changeAction: (next: Set<string>) => void;
}) {
  function handleClick(name: string) {
    const slug = name.toLowerCase();
    const next = new Set(selected);
    if (next.has(slug)) {
      next.delete(slug);
    } else {
      next.add(slug);
    }

    changeAction(next);
  }

  return (
    // Positioning wrapper outside ScrollArea, so the selected-count badge stays
    // pinned to the row's corner however far the chips scroll.
    <div className="relative">
      {/* ScrollArea's Viewport scrolls the row, for its custom thumb
          (components/ui/scroll-area.tsx). */}
      <ScrollArea
        className="-mt-2 -mr-2 -ml-2 mb-2 sm:mb-5"
        // The edge fade hints the row scrolls. On the Viewport, not the
        // content, so it fades the visible edge.
        viewportClassName="mask-[linear-gradient(to_right,black_calc(100%-56px),transparent_100%)]"
      >
        <div
          className="flex gap-4 pt-1 pr-2 pb-0.5 pl-2 sm:pt-2 sm:pb-1"
        >
          {tags.map((tag) => {
            const isSelected = selected.has(tag.name.toLowerCase());

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
                  {/* Selected tiles are near-black like a selected quick-filter
                      pill; Tag.color only drives the cards' top accent. */}
                  <span
                    className={cn(
                      "relative flex size-20 items-center justify-center overflow-hidden rounded-full shadow-sm",
                      isSelected ? "bg-foreground" : "bg-gray-50"
                    )}
                  >
                    <span className="relative inline-block text-3xl leading-none transition-transform duration-150 group-hover/chip:scale-[1.4]">
                      {tag.emoji}
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

      {/* Selected-count badge pinned to the row's top-right, so a selection
          scrolled out of view is still signalled. Always rendered
          (opacity/scale) for a smooth transition. aria-hidden: each chip's
          aria-pressed already conveys selection. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute -top-1 -right-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[0.6875rem] font-semibold text-primary-foreground shadow-sm transition-all duration-150",
          selected.size > 0 ? "scale-100 opacity-100" : "scale-75 opacity-0"
        )}
      >
        {selected.size}
      </span>
    </div>
  );
}
