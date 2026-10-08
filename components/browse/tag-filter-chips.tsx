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
    // ScrollArea's own Viewport does the scrolling/clipping instead of a
    // plain overflow-x-auto div, so its custom thumb (see
    // components/ui/scroll-area.tsx)
    <ScrollArea
      className="-mt-2 -mr-2 -ml-2 mb-5"
      // mask-image fades the visible edge to transparent as a hint that
      // the row scrolls. It has to live on the Viewport, not the scrolled
      // content: the content's own width is the full row (~17 chips), so
      // a mask on it would fade a fixed point near the end of all content
      // instead of the edge of what's actually visible right now.
      viewportClassName="mask-[linear-gradient(to_right,black_calc(100%-56px),transparent_100%)]"
    >
      <div
        className="flex gap-4 pt-2 pr-2 pl-2 pb-1"
        data-pending={isPending ? "" : undefined}
      >
        {tags.map((tag) => {
          const isSelected = optimisticSelected.has(tag.name.toLowerCase());

          return (
            <div key={tag.id} className="flex shrink-0 flex-col items-center gap-2.5 pb-2.5">
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
                className="group/chip"
              >
                {/* Color comes from the database via inline style rather
                    than a per-tag CSS class, since tags are editable data with
                    no fixed set of colors to pre-write classes for. */}
                <span
                  className={cn(
                    "relative flex size-20 items-center justify-center overflow-hidden rounded-[20%] shadow-sm",
                    isSelected ? "shadow-lg" : "bg-gray-50"
                  )}
                  style={isSelected ? { backgroundColor: tag.color } : undefined}
                >
                  {isSelected && (
                    <span className="pointer-events-none absolute inset-0 bg-linear-to-b from-white/25 via-transparent to-black/10" />
                  )}
                  <span className="relative inline-block text-2xl leading-none transition-transform duration-150 group-hover/chip:scale-[1.4]">
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
  );
}
