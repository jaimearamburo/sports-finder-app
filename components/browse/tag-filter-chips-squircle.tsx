"use client";

import { startTransition, useOptimistic } from "react";
import { getSvgPath } from "figma-squircle";
import { cn } from "@/lib/utils";
import { TAG_LABEL_TEXT_CLASS } from "@/lib/label-styles";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

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
    // ScrollArea's own Viewport does the scrolling/clipping instead of a
    // plain overflow-x-auto div, so its custom thumb (see
    // components/ui/scroll-area.tsx)
    <ScrollArea
      className="-mt-2 -mr-2 -ml-2 mb-2 sm:mb-5"
      // mask-image fades the visible edge to transparent as a hint that
      // the row scrolls. It has to live on the Viewport, not the scrolled
      // content: the content's own width is the full row (~17 chips), so
      // a mask on it would fade a fixed point near the end of all content
      // instead of the edge of what's actually visible right now.
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
                // active:scale-95 is the entire "selected" feel now - a flat
                // color fill plus a quick tactile press, not simulated
                // lighting (no gradient, no bevel). :active only matches
                // while the pointer/touch is actually down, so this fires as
                // a brief press-feedback on every click regardless of which
                // way it toggles, with no JS state of its own needed.
                className="group/chip transition-transform duration-150 active:scale-95"
              >
                {/* drop-shadow lives on a wrapper outside the clipped element:
                    filter and clip-path on the same element would compute the
                    shadow first and clip-path would then cut it off at the
                    shape's own boundary. drop-shadow-md (not the bare
                    drop-shadow utility, a ~1px/2px blur at 10% opacity) -
                    too faint to read reliably against this near-white
                    bg-[#fcfcfc] card on some mobile displays; the stronger
                    default still reads as a soft shadow, not a harsh one.
                    transform-[translateZ(0)] forces this wrapper onto its
                    own GPU compositing layer - without it, WebKit (every
                    browser on iOS is WebKit under the hood, Chrome
                    included - Apple requires it) has a known bug where a
                    filter on an element wrapping a clip-path'd child
                    doesn't paint at all rather than just rendering
                    wrong. */}
                <span className="drop-shadow-md transform-[translateZ(0)]">
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
