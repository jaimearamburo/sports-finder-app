"use client";

import { startTransition, useOptimistic } from "react";
import { cn } from "@/lib/utils";
import { TAG_STYLES } from "@/lib/browse-filters";

// this component owns the optimistic display + pending state and calls that
// callback inside its own transition.
export function TagChipGroup({
  tags,
  selected,
  changeAction,
}: {
  tags: { id: string; name: string }[];
  selected: Set<string>;
  changeAction: (next: Set<string>) => void;
}) {
  // One optimistic value for what's displayed as selected right now, one
  // purely as a pending flag - both apply on the current frame even
  // inside a transition, which is what makes a clicked chip highlight
  // instantly regardless of how long the resulting navigation takes.
  const [optimisticSelected, setOptimisticSelected] = useOptimistic(selected);
  const [isPending, setIsPending] = useOptimistic(false);

  function handleClick(name: string) {
    const slug = name.toLowerCase();
    // Computed from this component's own optimistic state, not the
    // `selected` prop — so a second click before the first navigation
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
        const style = TAG_STYLES[tag.name];
        const isSelected = optimisticSelected.has(tag.name.toLowerCase());

        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => handleClick(tag.name)}
            aria-pressed={isSelected}
            className={cn(
              "group/chip flex shrink-0 flex-col items-center gap-2.5 border-b-2 border-transparent pb-2.5",
              isSelected && style && `border-tag-${style.slug}`
            )}
          >
            <span
              className={cn(
                "relative flex size-20 items-center justify-center overflow-hidden rounded-[22%] bg-muted shadow-sm transition-shadow",
                isSelected && style && `bg-tag-${style.slug} shadow-lg`
              )}
            >
              {isSelected && (
                <span className="pointer-events-none absolute inset-0 bg-linear-to-b from-white/25 via-transparent to-black/10" />
              )}
              <span className="relative inline-block text-2xl leading-none transition-transform duration-150 group-hover/chip:scale-[1.5]">
                {style?.emoji ?? "🏷️"}
              </span>
            </span>
            <span className={cn("text-sm font-medium", isSelected ? "text-foreground" : "text-muted-foreground")}>
              {tag.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
