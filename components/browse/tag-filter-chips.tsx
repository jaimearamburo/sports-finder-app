"use client";

import { startTransition, useOptimistic } from "react";
import { cn } from "@/lib/utils";

type BrowseTag = { id: string; name: string; emoji: string; color: string };

// Shared with TagFiltersSkeleton so the skeleton's label bone tracks
// whatever text size the real label uses.
export const TAG_LABEL_TEXT_CLASS = "text-sm font-medium";

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
    <div className="mb-5 flex gap-5 overflow-x-auto pb-1" data-pending={isPending ? "" : undefined}>
      {tags.map((tag) => {
        const isSelected = optimisticSelected.has(tag.name.toLowerCase());

        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => handleClick(tag.name)}
            aria-pressed={isSelected}
            // Named group ("chip"). Tailwind's group-hover selector
            // matches any ancestor with a group class of the same name,
            // not only the nearest one. app/page.tsx has its own group
            // ("browse") for a separate dimming effect, and this needs a
            // distinct name so the two do not trigger each other.
            className="group/chip flex shrink-0 flex-col items-center gap-2.5 border-b-2 border-transparent pb-2.5"
            style={isSelected ? { borderColor: tag.color } : undefined}
          >
            {/* Color comes from the database via inline style rather 
                than a per-tag CSS class, since tags are editable data with 
                no fixed set of colors to pre-write classes for. */}
            <span
              className={cn(
                "relative flex size-20 items-center justify-center overflow-hidden rounded-[22%] shadow-sm",
                isSelected ? "shadow-lg" : "bg-muted"
              )}
              style={isSelected ? { backgroundColor: tag.color } : undefined}
            >
              {isSelected && (
                <span className="pointer-events-none absolute inset-0 bg-linear-to-b from-white/25 via-transparent to-black/10" />
              )}
              <span className="relative inline-block text-2xl leading-none transition-transform duration-150 group-hover/chip:scale-[1.5]">
                {tag.emoji}
              </span>
            </span>
            <span className={cn(TAG_LABEL_TEXT_CLASS, isSelected ? "text-foreground" : "text-muted-foreground")}>
              {tag.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
