"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatTimeOfDay, minutesSinceMidnight } from "@/lib/time-of-day";
import type { PickerListing, SelectedSlots } from "./picker-types";

function formatOccurrenceDate(date: Date): string {
  return date.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

// No calendar here on purpose - the day-of-week and time are already
// fixed by the listing itself, so a grid of mostly-irrelevant days would
// just be noise. The only real decision is which upcoming week.
export function FixedSessionPicker({
  listing,
  bookableDates,
  onSelect,
}: {
  listing: PickerListing;
  bookableDates: Date[];
  onSelect: (slots: SelectedSlots | null) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);

  if (!listing.recurrenceStartTime || !listing.sessionDurationMinutes) {
    return <p className="text-sm text-muted-foreground">This listing has no schedule configured.</p>;
  }

  const startMinutes = minutesSinceMidnight(listing.recurrenceStartTime);
  const sessionDurationMinutes = listing.sessionDurationMinutes;

  function pick(date: Date) {
    setSelected(date.getTime());
    const startsAt = new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        Math.floor(startMinutes / 60),
        startMinutes % 60
      )
    );
    onSelect([{ startsAt, endsAt: new Date(startsAt.getTime() + sessionDurationMinutes * 60000) }]);
  }

  return (
    <div className="flex flex-col gap-2">
      {bookableDates.map((date) => (
        <button
          key={date.getTime()}
          type="button"
          onClick={() => pick(date)}
          className={cn(
            "flex items-center justify-between rounded-md border px-3.5 py-2.5 text-left text-sm font-medium transition-colors",
            date.getTime() === selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-foreground hover:border-foreground/50"
          )}
        >
          <span>
            {formatOccurrenceDate(date)} · {formatTimeOfDay(listing.recurrenceStartTime!)}
          </span>
        </button>
      ))}
    </div>
  );
}
