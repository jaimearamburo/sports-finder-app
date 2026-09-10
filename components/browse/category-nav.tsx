"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// Broad groupings for the sidebar — coarser than the Tag/ActivityTag
// filter row (ticket 4.3) that'll sit above the results. These aren't
// backed by a DB table; they're a fixed, hand-picked grouping of the
// Activity catalog for browsing, not a filter with real query wiring yet.
const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "courts", label: "Courts for hire" },
  { id: "classes", label: "Classes" },
  { id: "gym", label: "Gym" },
  { id: "camping", label: "Camping" },
] as const;

export function CategoryNav() {
  const [activeId, setActiveId] = useState<(typeof CATEGORIES)[number]["id"]>("all");

  return (
    <nav aria-label="Browse categories" className="flex flex-col">
      {CATEGORIES.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => setActiveId(category.id)}
          aria-current={activeId === category.id ? "true" : undefined}
          className={cn(
            "border-l-2 border-transparent px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            activeId === category.id && "border-primary bg-muted/60 font-semibold text-foreground"
          )}
        >
          {category.label}
        </button>
      ))}
    </nav>
  );
}
