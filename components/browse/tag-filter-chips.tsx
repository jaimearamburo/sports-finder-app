"use client";

import { startTransition, useOptimistic } from "react";
import { cn } from "@/lib/utils";
import { TAG_LABEL_TEXT_CLASS } from "@/lib/label-styles";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

type BrowseTag = { id: string; name: string; emoji: string; color: string };

// Renders the actual chips with no knowledge of URLs or routing. TagFilters
// owns the URL logic and passes a plain callback down; this component owns
// the optimistic display and pending state and calls that callback inside
// its own transition.
export function TagFilterChips({
  tags,
  selected,
  changeAction,
}: {
  tags: BrowseTag[];
  selected: Set<string>;
  changeAction: (next: Set<string>) => void;
}) {
  // One optimistic value for what is displayed as selected right now, one
  // purely as a pending flag. Both apply on the current frame even inside
  // a transition, which makes a clicked chip highlight instantly
  // regardless of how long the resulting navigation takes.
  const [optimisticSelected, setOptimisticSelected] = useOptimistic(selected);
  const [isPending, setIsPending] = useOptimistic(false);

  function handleClick(name: string) {
    const slug = name.toLowerCase();
    // Computed from this component's own optimistic state, not the
    // selected prop, so a second click before the first navigation
    // resolves still toggles correctly instead of reading a stale value.
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
                  // Named group ("chip"). Tailwind's group-hover selector
                  // matches any ancestor with a group class of the same name,
                  // not only the nearest one. app/page.tsx has its own group
                  // ("browse") for a separate dimming effect, and this needs a
                  // distinct name so the two do not trigger each other. Only
                  // the icon lives inside the button, so hover/click apply to
                  // it alone, not the label below.
                  //
                  // active:scale-95 is the entire "selected" feel now - a
                  // flat color fill plus a quick tactile press, not simulated
                  // lighting (no gradient, no bevel). :active only matches
                  // while the pointer/touch is actually down, so this fires
                  // as a brief press-feedback on every click regardless of
                  // which way it toggles, with no JS state of its own needed.
                  className="group/chip transition-transform duration-150 active:scale-95"
                >
                  {/* Color comes from the database via inline style rather
                      than a per-tag CSS class, since tags are editable data with
                      no fixed set of colors to pre-write classes for. */}
                  <span
                    className={cn(
                      "relative flex size-20 items-center justify-center overflow-hidden rounded-[20%] shadow-sm",
                      !isSelected && "bg-gray-50"
                    )}
                    style={isSelected ? { backgroundColor: tag.color } : undefined}
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
          optimisticSelected.size > 0 ? "scale-100 opacity-100" : "scale-75 opacity-0"
        )}
      >
        {optimisticSelected.size}
      </span>
    </div>
  );
}
