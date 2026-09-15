"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// Visual only, as per the mockup - not wired to the query yet.
const PILLS = ["Sort: Recommended", "Available today", "Top rated", "Under $30"];

export function QuickFilters() {
  const [active, setActive] = useState<Set<string>>(new Set(["Sort: Recommended"]));

  function toggle(pill: string) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(pill)) {
        next.delete(pill);
      } else {
        next.add(pill);
      }
      return next;
    });
  }

  return (
    <div className="mb-7 flex items-center gap-2.5 overflow-x-auto">
      {PILLS.map((pill) => (
        <button
          key={pill}
          type="button"
          onClick={() => toggle(pill)}
          aria-pressed={active.has(pill)}
          className={cn(
            "h-9 shrink-0 rounded-md border bg-card px-3.5 text-sm font-medium text-muted-foreground hover:border-foreground/50 hover:text-foreground",
            active.has(pill) && "border-foreground bg-foreground text-background hover:border-foreground hover:text-background"
          )}
        >
          {pill}
        </button>
      ))}
    </div>
  );
}
