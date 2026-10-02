"use client";

import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { startOfUTCDay } from "@/lib/dates";
import type { PickerListing, SelectedSlot } from "./picker-types";

// react-day-picker's range `min`/`max` count differenceInCalendarDays(to,
// from) - the exclusive-end gap between the two dates, not an inclusive
// day count - which is exactly the same arithmetic
// isRequestedSlotValid's date_range branch already uses for durationDays.
// That's what lets minDurationDays/maxDurationDays be passed straight
// through with no adjustment.
export function DateRangePicker({
  listing,
  bookableDates,
  onSelect,
}: {
  listing: PickerListing;
  bookableDates: Date[];
  onSelect: (slot: SelectedSlot | null) => void;
}) {
  const [range, setRange] = useState<DateRange | undefined>(undefined);

  const bookableSet = useMemo(() => new Set(bookableDates.map((d) => d.getTime())), [bookableDates]);

  function handleSelect(next: DateRange | undefined) {
    setRange(next);
    if (next?.from && next?.to) {
      onSelect({ startsAt: next.from, endsAt: next.to });
    } else {
      onSelect(null);
    }
  }

  return (
    <div>
      <Calendar
        mode="range"
        numberOfMonths={2}
        selected={range}
        onSelect={handleSelect}
        disabled={(date) => !bookableSet.has(startOfUTCDay(date).getTime())}
        min={listing.minDurationDays ?? undefined}
        max={listing.maxDurationDays ?? undefined}
        className="rounded-md border"
      />
      {range?.from && !range.to && (
        <p className="mt-2 text-sm text-muted-foreground">Pick an end date to complete the stay.</p>
      )}
    </div>
  );
}
