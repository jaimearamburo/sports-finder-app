"use client";

import { startTransition, useOptimistic } from "react";
import { getSvgPath } from "figma-squircle";
import { cn } from "@/lib/utils";
import { TAG_LABEL_TEXT_CLASS } from "@/lib/label-styles";

type BrowseTag = { id: string; name: string; emoji: string; color: string };

// A true continuous-curve squircle (the Figma "corner smoothing"
// curve), not rounded-[20%]'s ellipse-based approximation. Computed once
// at module scope since every chip icon is the same fixed size.
// ICON_SIZE is the single source of truth: it sizes both the clip path
// and the icon span below, so the two can't drift out of sync.
const ICON_SIZE = 80;
const SQUIRCLE_CLIP_PATH = `path('${getSvgPath({
  width: ICON_SIZE,
  height: ICON_SIZE,
  cornerRadius: 22,
  cornerSmoothing: 1,
})}')`;

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
    // overflow-x-auto also clips vertically (CSS forces overflow-y to
    // auto once overflow-x isn't visible), cutting off drop-shadow at the
    // row's edges. pt/pl/pr give the shadow room; the matching negative
    // margins cancel that padding so the row's outer position is unchanged.
    <div
      className="-mt-2 -mr-2 -ml-2 mb-5 flex gap-4 overflow-x-auto pt-2 pr-2 pl-2 pb-1"
      data-pending={isPending ? "" : undefined}
    >
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
            {/* drop-shadow lives on a wrapper outside the clipped element:
                filter and clip-path on the same element would compute the
                shadow first and clip-path would then cut it off at the
                shape's own boundary. */}
            <span className={cn(isSelected ? "drop-shadow" : "drop-shadow")}>
              {/* Color comes from the database via inline style, since
                  tags are editable data with no fixed palette to
                  pre-write classes for. The clip-path shape already
                  clips its own contents, so no overflow-hidden is
                  needed. Width/height come from ICON_SIZE, not a size-*
                  class, so the box always matches the clip path. */}
              <span
                className={cn(
                  "relative flex items-center justify-center",
                  // Grayscale hex (equal R/G/B) instead of a bg-gray-* step,
                  // since the palette's lightest step (gray-50, #fafafa) is
                  // as light as its numbered scale goes. Nudge the repeated
                  // hex pair toward ff (lighter) or fa (darker) to retune.
                  !isSelected && "bg-[#fcfcfc]"
                )}
                style={{
                  width: ICON_SIZE,
                  height: ICON_SIZE,
                  clipPath: SQUIRCLE_CLIP_PATH,
                  ...(isSelected ? { backgroundColor: tag.color } : {}),
                }}
              >
                {isSelected && (
                  <span className="pointer-events-none absolute inset-0 bg-linear-to-b from-white/25 via-transparent to-black/10" />
                )}
                <span className="relative inline-block text-2xl leading-none transition-transform duration-150 group-hover/chip:scale-[1.4]">
                  {tag.emoji}
                </span>
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
