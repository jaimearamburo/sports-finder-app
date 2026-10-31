"use client";

import { cn } from "@/lib/utils";
import { PRICE_MIN, PRICE_MAX } from "@/lib/price-range";
import { DateFilterPopover } from "@/components/browse/date-filter-popover";

export type QuickFilterValues = {
  // "" (no date filter), "yyyy-mm-dd" (one day) or "yyyy-mm-dd,yyyy-mm-dd" (the
  // weekend pair), as in the URL.
  date: string;
  // Both bounds: Free sets the whole range, so a raised priceMin can't leave an
  // impossible range.
  priceMin: number;
  priceMax: number;
};

const PILL_CLASS =
  "h-9 shrink-0 rounded-md border bg-card px-3.5 text-sm font-medium text-muted-foreground hover:border-foreground/50 hover:text-foreground";
const PILL_ACTIVE_CLASS =
  "border-foreground bg-foreground text-background hover:border-foreground hover:text-background";

// yyyy-mm-dd from the Date's local y/m/d (toISOString would shift the day east
// of UTC). ListingSection reads it as a calendar day.
function toDateParam(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Inverse of toDateParam, built from local y/m/d so the calendar highlights the
// right day in any timezone.
function parseDateParam(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// The nearest Saturday and Sunday on or after the viewer's local today (browse
// spans many timezones, so there's no venue to anchor to). On a Sunday: today
// and next Saturday.
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

// Renders the pills without URL logic. Values include a change still loading
// (useBrowseFilters). "This weekend" and the date popover share the `date` key,
// so one always replaces the other.
export function QuickFiltersPanel({
  date,
  priceMin,
  priceMax,
  changeAction,
}: QuickFilterValues & { changeAction: (next: QuickFilterValues) => void }) {
  const current: QuickFilterValues = { date, priceMin, priceMax };

  // The weekend pair has no single day to highlight, so the popover shows "Any
  // date".
  const selectedDate = current.date && !current.date.includes(",") ? parseDateParam(current.date) : undefined;
  const isWeekendActive = current.date === weekendDateParam();
  const isFreeActive = current.priceMax === 0;

  return (
    <div className="mb-2 flex items-center gap-2.5 overflow-x-auto sm:mb-5">
      <DateFilterPopover
        selectedDate={selectedDate}
        onCommit={(d) => changeAction({ ...current, date: d ? toDateParam(d) : "" })}
      />
      <button
        type="button"
        aria-pressed={isWeekendActive}
        onClick={() => changeAction({ ...current, date: isWeekendActive ? "" : weekendDateParam() })}
        className={cn(PILL_CLASS, isWeekendActive && PILL_ACTIVE_CLASS)}
      >
        This weekend
      </button>
      <button
        type="button"
        aria-pressed={isFreeActive}
        onClick={() =>
          changeAction({
            ...current,
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
