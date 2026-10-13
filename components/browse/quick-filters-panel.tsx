"use client";

import { startTransition, useOptimistic } from "react";
import { cn } from "@/lib/utils";
import { PRICE_MIN, PRICE_MAX } from "@/lib/price-range";
import { DateFilterPopover } from "@/components/browse/date-filter-popover";

export type QuickFilterValues = {
  // "" (no date filter), "yyyy-mm-dd" (one specific day), or
  // "yyyy-mm-dd,yyyy-mm-dd" (the "This weekend" pill's Saturday+Sunday).
  // Kept as the raw URL-shaped string, not pre-parsed into Dates, so each
  // pill below only parses the slice it actually cares about.
  date: string;
  // Both bounds, not just priceMax - if the sidebar's own price slider
  // already raised priceMin above 0, setting priceMax alone to 0 would
  // produce an impossible range (gte priceMin, lte 0) and silently return
  // zero results. Free owns the whole price range when active rather than
  // layering a delta on top of whatever the sidebar left behind.
  priceMin: number;
  priceMax: number;
};

const PILL_CLASS =
  "h-9 shrink-0 rounded-md border bg-card px-3.5 text-sm font-medium text-muted-foreground hover:border-foreground/50 hover:text-foreground";
const PILL_ACTIVE_CLASS =
  "border-foreground bg-foreground text-background hover:border-foreground hover:text-background";

// yyyy-mm-dd read off the Date's own LOCAL year/month/day, not
// toISOString() (which converts through UTC first) - a Date built from the
// local calendar day the user actually meant, and toISOString() shifts
// that backwards by a day for anyone east of UTC (e.g. Australia): local
// midnight Oct 6 AEDT is already Oct 5 in UTC, so the param would silently
// become the wrong day. The string itself is the only thing that needs to
// survive the trip to the server - ListingSection parses it as a UTC
// calendar day on its own terms (matching the rest of
// lib/availability.ts's UTC-day convention), which is a separate,
// internally consistent interpretation that never needs to agree with
// this component's local one, only with the same digits.
function toDateParam(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// The inverse of toDateParam - built from local y/m/d rather than parsing
// the string as a UTC instant (`new Date("...T00:00:00Z")`), so the
// Calendar's own local-time day comparisons highlight the right date
// regardless of which side of UTC the browser's timezone is on.
function parseDateParam(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// The nearest Saturday and Sunday each on or after the viewer's own local
// today - there's no single venue to anchor "today" to at this point in
// the UI, since the browse grid spans many venues/timezones at once (same
// reasoning DateFilterPopover's own past-date disabling already uses).
// On a Sunday this resolves to {today, next Saturday} rather than jumping
// a full week ahead for both - a deliberate simplification: once the
// weekend has already started, "this weekend" colloquially still means
// the one that's ending, not next week's.
function nextWeekendDates(): [Date, Date] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntilSaturday = (6 - today.getDay() + 7) % 7;
  const daysUntilSunday = (0 - today.getDay() + 7) % 7;
  return [
    new Date(today.getTime() + daysUntilSaturday * 24 * 60 * 60 * 1000),
    new Date(today.getTime() + daysUntilSunday * 24 * 60 * 60 * 1000),
  ];
}

function weekendDateParam(): string {
  const [saturday, sunday] = nextWeekendDates();
  return `${toDateParam(saturday)},${toDateParam(sunday)}`;
}

// Mirrors BrowseSidebarPanel's role for the quick-filters row: owns one
// shared optimistic value and one shared pending flag for every pill here,
// rather than each pill tracking its own. There's only ever one navigation
// in flight for the page at a time, so one isPending is both simpler and
// more correct than duplicating it per pill - and sharing one optimistic
// value object is what makes "This weekend" and the specific-date popover
// provably unable to conflict: they read and write the same `date` key on
// the same object, so picking one always overwrites the other outright
// rather than needing to remember to clear it.
export function QuickFiltersPanel({
  date,
  priceMin,
  priceMax,
  changeAction,
}: QuickFilterValues & { changeAction: (next: QuickFilterValues) => void }) {
  const [optimistic, setOptimistic] = useOptimistic<QuickFilterValues>({ date, priceMin, priceMax });
  const [isPending, setIsPending] = useOptimistic(false);

  function commitFilters(next: QuickFilterValues) {
    startTransition(() => {
      setOptimistic(next);
      setIsPending(true);
      changeAction(next);
    });
  }

  // A two-date value (the weekend pair) has no single day to highlight on
  // the specific-date popover's own calendar - it shows its resting "Any
  // date" state instead, and picking a day from it overwrites the pair,
  // same as picking a day always overwrites whatever was there before.
  const selectedDate = optimistic.date && !optimistic.date.includes(",") ? parseDateParam(optimistic.date) : undefined;
  const isWeekendActive = optimistic.date === weekendDateParam();
  const isFreeActive = optimistic.priceMax === 0;

  return (
    <div data-pending={isPending ? "" : undefined} className="mb-2 flex items-center gap-2.5 overflow-x-auto sm:mb-7">
      <DateFilterPopover
        selectedDate={selectedDate}
        onCommit={(d) => commitFilters({ ...optimistic, date: d ? toDateParam(d) : "" })}
      />
      <button
        type="button"
        aria-pressed={isWeekendActive}
        onClick={() => commitFilters({ ...optimistic, date: isWeekendActive ? "" : weekendDateParam() })}
        className={cn(PILL_CLASS, isWeekendActive && PILL_ACTIVE_CLASS)}
      >
        This weekend
      </button>
      <button
        type="button"
        aria-pressed={isFreeActive}
        onClick={() =>
          commitFilters({
            ...optimistic,
            priceMin: PRICE_MIN,
            priceMax: isFreeActive ? PRICE_MAX : 0,
          })
        }
        className={cn(PILL_CLASS, isFreeActive && PILL_ACTIVE_CLASS)}
      >
        Free
      </button>
    </div>
  );
}
