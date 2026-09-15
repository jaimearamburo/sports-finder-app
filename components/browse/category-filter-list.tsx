"use client";

import { startTransition, useOptimistic } from "react";
import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/lib/category-filters";

// Shared with CategoryFiltersSkeleton so the skeleton's label bone tracks
// whatever text size the real label uses.
export const CATEGORY_LABEL_TEXT_CLASS = "text-sm font-medium";

// Renders the category nav links with no knowledge of URLs or routing.
// CategoryFilters owns the URL logic and passes a plain callback down;
// this component owns the optimistic display and pending state and calls
// that callback inside its own transition. Separating a component that
// reads useSearchParams() from one that manages useOptimistic/
// startTransition state keeps rapid clicks from contending with each
// other during rerenders.
export function CategoryFilterList({
  activeId,
  changeAction,
}: {
  activeId: string;
  changeAction: (id: string) => void;
}) {
  const [optimisticActiveId, setOptimisticActiveId] = useOptimistic(activeId);
  const [isPending, setIsPending] = useOptimistic(false);

  function handleClick(id: string) {
    startTransition(() => {
      setOptimisticActiveId(id);
      setIsPending(true);
      changeAction(id);
    });
  }

  return (
    <nav aria-label="Browse categories" className="flex flex-col" data-pending={isPending ? "" : undefined}>
      {CATEGORIES.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => handleClick(category.id)}
          aria-current={optimisticActiveId === category.id ? "true" : undefined}
          className={cn(
            "border-l-2 border-transparent px-3 py-2 text-left",
            CATEGORY_LABEL_TEXT_CLASS,
            "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            optimisticActiveId === category.id &&
              "border-primary bg-muted/60 font-semibold text-foreground"
          )}
        >
          {category.label}
        </button>
      ))}
    </nav>
  );
}
