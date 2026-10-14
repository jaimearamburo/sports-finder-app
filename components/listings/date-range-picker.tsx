"use client";

import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Check } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { addDays, localDateToUTCDay } from "@/lib/dates";
import type { PickerListing, SelectedSlots } from "./picker-types";

// react-day-picker's range `min`/`max` count differenceInCalendarDays(to,
// from) - the exclusive-end gap between the two dates, not an inclusive
// day count - which is exactly the same arithmetic
// isRequestedSlotValid's date_range branch already uses for durationDays.
// That's what lets minDurationDays/maxDurationDays be passed straight
// through with no adjustment, in both branches below.
export function DateRangePicker({
  listing,
  bookableDates,
  onSelect,
}: {
  listing: PickerListing;
  bookableDates: Date[];
  onSelect: (slots: SelectedSlots | null) => void;
}) {
  // Both branches' state is declared unconditionally here, even though
  // only one is ever actually used for a given listing - isAccommodation
  // never changes for an already-mounted instance, but conditionally
  // calling useState itself would still break React's rules of hooks.
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [selectedDates, setSelectedDates] = useState<Date[] | undefined>(undefined);

  const bookableSet = useMemo(() => new Set(bookableDates.map((d) => d.getTime())), [bookableDates]);
  // localDateToUTCDay, not startOfUTCDay: the Calendar hands back a Date
  // built from the browser's LOCAL midnight for the clicked day, which
  // startOfUTCDay would reinterpret through UTC's clock instead of
  // preserving (see that function's own comment in lib/dates.ts) -
  // silently shifting the day back by one for anyone east of UTC.
  const isDisabled = (date: Date) => !bookableSet.has(localDateToUTCDay(date).getTime());

  // A pass/ticket (not accommodation): the days it covers don't need to be
  // consecutive - a "3-day pass" might mean the 19th, 23rd, and 30th, not
  // one contiguous block, so this is "multiple" mode, not "range." Each
  // picked day becomes its own one-day span rather than one span covering
  // the whole stretch, which would wrongly claim the gap days too.
  if (!listing.isAccommodation) {
    function handleMultiSelect(dates: Date[] | undefined) {
      setSelectedDates(dates);
      if (dates && dates.length > 0) {
        // localDateToUTCDay before use, not the raw calendar Date - see
        // isDisabled's comment above. Without it, a selected day could get
        // booked as the wrong UTC calendar day for anyone east of UTC.
        onSelect(
          dates.map((d) => {
            const utcDay = localDateToUTCDay(d);
            return { startsAt: utcDay, endsAt: addDays(utcDay, 1) };
          })
        );
      } else {
        onSelect(null);
      }
    }

    // "Required" means the minimum needed to be bookable, not the
    // maximum - a 1-5 day pass is already a complete, valid purchase at
    // exactly 1 day. The hint text below is built off minDurationDays
    // rather than maxDurationDays for that reason, even though the
    // Calendar's own min/max props, and the onSelect/pricing flow above,
    // already accept anywhere in that range.
    const min = listing.minDurationDays ?? 1;
    const max = listing.maxDurationDays ?? min;
    const selectedCount = selectedDates?.length ?? 0;
    const complete = selectedCount >= min;
    const rangeLabel = min === max ? `${min} day${min === 1 ? "" : "s"}` : `${min}-${max} days`;

    return (
      <div>
        <p className={cn("mb-2 flex items-center gap-1.5 text-sm", complete ? "text-muted-foreground/60" : "text-foreground")}>
          {complete ? (
            <>
              <Check className="size-4" /> {selectedCount} day{selectedCount === 1 ? "" : "s"} selected
            </>
          ) : (
            `Select ${rangeLabel} (${selectedCount}/${min})`
          )}
        </p>
        <Calendar
          mode="multiple"
          selected={selectedDates}
          onSelect={handleMultiSelect}
          disabled={isDisabled}
          min={listing.minDurationDays ?? undefined}
          max={listing.maxDurationDays ?? undefined}
          className="rounded-md border"
        />
      </div>
    );
  }

  // Accommodation: always a contiguous check-in/check-out range, even for
  // a 1-night stay - the length being fixed doesn't make the arrival/
  // departure distinction go away the way it does for a same-day pass.
  function handleRangeSelect(next: DateRange | undefined) {
    setRange(next);
    if (next?.from && next?.to) {
      // Same localDateToUTCDay conversion as isDisabled/handleMultiSelect
      // above - next.from/next.to are local-midnight Dates straight from
      // the calendar.
      onSelect([{ startsAt: localDateToUTCDay(next.from), endsAt: localDateToUTCDay(next.to) }]);
    } else {
      onSelect(null);
    }
  }

  const complete = !!(range?.from && range?.to);

  return (
    <div>
      <p className={cn("mb-2 flex items-center gap-1.5 text-sm", complete ? "text-muted-foreground/60" : "text-foreground")}>
        {complete ? (
          <>
            <Check className="size-4" /> Stay dates selected
          </>
        ) : range?.from ? (
          "Pick a check-out date to complete the stay."
        ) : (
          "Select your check-in date."
        )}
      </p>
      <Calendar
        mode="range"
        numberOfMonths={2}
        selected={range}
        onSelect={handleRangeSelect}
        disabled={isDisabled}
        min={listing.minDurationDays ?? undefined}
        max={listing.maxDurationDays ?? undefined}
        className="rounded-md border"
      />
    </div>
  );
}
