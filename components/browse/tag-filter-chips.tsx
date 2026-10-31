"use client";

import { cn } from "@/lib/utils";
import { TAG_LABEL_TEXT_CLASS } from "@/lib/label-styles";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

type BrowseTag = { id: string; name: string; emoji: string; color: string };

// Renders the actual chips with no knowledge of URLs or routing. TagFilters
// owns the URL logic and passes a plain callback down. `selected` already
// includes a change that's still loading (see useBrowseFilters), so a
// clicked chip highlights straight away, and a second quick click builds on
// the first.
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
    // relative wrapper, not ScrollArea's own className (which lands
    // inside its Viewport and would scroll away with the content) - the
    // selected-count badge below needs to stay pinned to this row's own
    // corner regardless of how far the chips underneath have scrolled,
    // which is exactly the problem it exists to solve: a selection made
    // far enough to one side that scrolling back the other way hides it
    // completely, with nothing on screen hinting it's still there.
    <div className="relative">
      {/* ScrollArea's own Viewport does the scrolling/clipping instead of
          a plain overflow-x-auto div, so its custom thumb (see
          components/ui/scroll-area.tsx) */}
      <ScrollArea
        className="-mt-2 -mr-2 -ml-2 mb-2 sm:mb-5"
        // mask-image fades the visible edge to transparent as a hint that
        // the row scrolls. It has to live on the Viewport, not the
        // scrolled content: the content's own width is the full row (~17
        // chips), so a mask on it would fade a fixed point near the end
        // of all content instead of the edge of what's actually visible
        // right now.
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
                  // Named group ("chip"). Tailwind's group-hover selector
                  // matches any ancestor with a group class of the same name,
                  // not only the nearest one, so a distinct name keeps it
                  // from reacting to some other group further up the page.
                  // Only the icon lives inside the button, so hover/click
                  // apply to it alone, not the label below.
                  //
                  // active:scale-95 gives tap feedback: a brief scale-down
                  // while the pointer or touch is down, independent of which
                  // way the click toggles selection, with no JS state needed.
                  className="group/chip transition-transform duration-150 active:scale-95"
                >
                  {/* Selected tiles are near-black, the same as a selected
                      quick-filter pill, rather than each tag's own colour
                      (Tag.color still drives the listing cards' top accent). */}
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

      {/* Selected-count badge, pinned to this row's own top-right corner
          regardless of scroll position - the only thing on screen that
          still signals a selection exists once the chip itself has been
          scrolled out of view. Always rendered (opacity/scale toggle,
          not a conditional mount) for a smooth transition in and out
          rather than a pop; aria-hidden since each chip's own
          aria-pressed already carries this information for assistive
          tech, which doesn't have a "scrolled off-screen" problem to
          begin with. */}
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
