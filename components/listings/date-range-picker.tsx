"use client";

import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Check } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { addDays, localDateToUTCDay } from "@/lib/dates";
import type { PickerListing, SelectedSlots } from "./picker-types";

// react-day-picker's range min/max count the exclusive gap between dates, the
// same arithmetic isRequestedSlotValid uses, so minDurationDays/maxDurationDays
// pass straight through.
export function DateRangePicker({
  listing,
  bookableDates,
  fullyBookedDates,
  onSelect,
}: {
  listing: PickerListing;
  bookableDates: Date[];
  // Dates fully claimed by bookings and holds (getFullyBookedDates). Undefined
  // is treated as none.
  fullyBookedDates?: Date[];
  onSelect: (slots: SelectedSlots | null) => void;
}) {
  // Both modes' state is declared unconditionally (rules of hooks); only one is
  // used per listing.
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [selectedDates, setSelectedDates] = useState<Date[] | undefined>(undefined);

  const bookableSet = useMemo(() => new Set(bookableDates.map((d) => d.getTime())), [bookableDates]);
  const fullyBookedSet = useMemo(
    () => new Set((fullyBookedDates ?? []).map((d) => d.getTime())),
    [fullyBookedDates]
  );
  // localDateToUTCDay: the calendar returns local midnight, and startOfUTCDay
  // would shift it back a day east of UTC.
  const isDisabled = (date: Date) => {
    const utcDay = localDateToUTCDay(date).getTime();
    return !bookableSet.has(utcDay) || fullyBookedSet.has(utcDay);
  };

  // A pass: picked days needn't be consecutive, so "multiple" mode, with each
  // day its own one-day slot (one span would also claim the days in between).
  if (!listing.isAccommodation) {
    function handleMultiSelect(dates: Date[] | undefined) {
      setSelectedDates(dates);
      if (dates && dates.length > 0) {
        // Convert local-midnight calendar Dates to UTC days (see isDisabled).
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

    // The hint counts towards the minimum: a 1-5 day pass is complete at one
    // day.
    const min = listing.minDurationDays ?? 1;
    const max = listing.maxDurationDays ?? min;
    const selectedCount = selectedDates?.length ?? 0;
    // At the maximum, unpicked days are disabled until one is unpicked;
    // otherwise react-day-picker replaces the whole selection with the new day.
    // A one-day pass keeps that swap.
    const atMax = max > 1 && selectedCount >= max;
    const isDisabledForPass = (date: Date) =>
      isDisabled(date) || (atMax && !selectedDates?.some((d) => d.getTime() === date.getTime()));
    const complete = selectedCount >= min;
    const rangeLabel = min === max ? `${min} day${min === 1 ? "" : "s"}` : `${min}-${max} days`;

    return (
      <div>
        <p className={cn("mb-2 flex items-center gap-1.5 text-sm", complete ? "text-muted-foreground" : "text-foreground")}>
          {complete ? (
            <>
              <Check className="size-4" /> {selectedCount} day{selectedCount === 1 ? "" : "s"} selected
              {atMax && ", the most allowed. Unpick one to change."}
            </>
          ) : (
            `Select ${rangeLabel} (${selectedCount}/${min})`
          )}
        </p>
        <Calendar
          mode="multiple"
          selected={selectedDates}
          onSelect={handleMultiSelect}
          disabled={isDisabledForPass}
          min={listing.minDurationDays ?? undefined}
          max={listing.maxDurationDays ?? undefined}
          className="rounded-md border"
        />
      </div>
    );
  }

  // A stay: always a contiguous check-in/check-out range.
  function handleRangeSelect(next: DateRange | undefined) {
    setRange(next);
    if (next?.from && next?.to) {
      // Same local-to-UTC-day conversion as above.
      onSelect([{ startsAt: localDateToUTCDay(next.from), endsAt: localDateToUTCDay(next.to) }]);
    } else {
      onSelect(null);
    }
  }

  const complete = !!(range?.from && range?.to);

  return (
    <div>
      <p className={cn("mb-2 flex items-center gap-1.5 text-sm", complete ? "text-muted-foreground" : "text-foreground")}>
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
