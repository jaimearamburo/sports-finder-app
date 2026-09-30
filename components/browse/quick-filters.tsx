"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// Visual only, as per the mockup - not wired to the query yet. Sort and
// Top rated were dropped: Sort has no real signal to sort on yet (no
// popularity/distance data), and Top rated depends on reviews (explicitly
// cut from MVP scope). Available today and Under $30 stay - Available
// today is real product intent (per the mechanic-based default: courts
// narrowed to today, classes/multi-day show everything), just not
// wireable to an actual query until the availability/conflict-check
// engine (ticket 5.4) exists; Under $30 is a deliberate fast one-tap
// shortcut kept alongside the sidebar's price slider, not a duplicate to
// remove.
const PILLS = ["Available today", "Under $30"];

export function QuickFilters() {
  const [active, setActive] = useState<Set<string>>(new Set(["Available today"]));

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
