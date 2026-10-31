"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatTimeOfDay, addMinutesToTime, zonedOccurrenceStart, minutesSinceMidnight, isPastToday } from "@/lib/time-of-day";
import type { PickerListing, SelectedSlots } from "./picker-types";

// Long and short date formats, swapped by breakpoint classes: weekday and month
// are both abbreviated on phones to fit the end time and spots count.
function formatOccurrenceDateLong(date: Date): string {
  return date.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function formatOccurrenceDateShort(date: Date): string {
  return date.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

// null/undefined means unlimited or unknown: no spots text.
function getSpotsText(spotsLeft: number | null | undefined): string | null {
  if (spotsLeft === null || spotsLeft === undefined) return null;
  if (spotsLeft <= 0) return "Fully booked";
  return `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`;
}

// No calendar: the weekday and time are fixed, so the only choice is which
// week.
export function FixedSessionPicker({
  listing,
  bookableDates,
  spotsRemaining,
  onSelect,
}: {
  listing: PickerListing;
  bookableDates: Date[];
  spotsRemaining?: Map<number, number | null>;
  onSelect: (slots: SelectedSlots | null) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);

  if (!listing.recurrenceStartTime || !listing.sessionDurationMinutes) {
    return <p className="text-sm text-muted-foreground">This listing has no schedule configured.</p>;
  }

  const sessionDurationMinutes = listing.sessionDurationMinutes;
  // The same for every occurrence.
  const endTime = addMinutesToTime(listing.recurrenceStartTime, sessionDurationMinutes);

  // Today's occurrence is hidden once it has started (venue clock). The server
  // applies the same rule in isRequestedSlotValid.
  const visibleDates = bookableDates.filter(
    (date) => !isPastToday(date, minutesSinceMidnight(listing.recurrenceStartTime!), listing.venueTimezone)
  );

  function pick(date: Date) {
    setSelected(date.getTime());
    // The recurrence time is venue wall-clock time, not UTC.
    const startsAt = zonedOccurrenceStart(date, listing.recurrenceStartTime!, listing.venueTimezone);
    onSelect([{ startsAt, endsAt: new Date(startsAt.getTime() + sessionDurationMinutes * 60000) }]);
  }

  if (visibleDates.length === 0) {
    return <p className="text-sm text-muted-foreground">No upcoming availability right now.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {visibleDates.map((date) => {
        const spotsLeft = spotsRemaining?.get(date.getTime());
        const isFull = spotsLeft !== null && spotsLeft !== undefined && spotsLeft <= 0;
        const spotsText = getSpotsText(spotsLeft);

        return (
          <button
            key={date.getTime()}
            type="button"
            disabled={isFull}
            onClick={() => pick(date)}
            className={cn(
              "flex items-center justify-between rounded-md border px-3.5 py-2.5 text-left text-sm font-medium transition-colors",
              isFull
                ? "cursor-not-allowed border-border bg-card text-muted-foreground opacity-50"
                : date.getTime() === selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-foreground/50"
            )}
          >
            <span>
              <span className="hidden sm:inline">{formatOccurrenceDateLong(date)}</span>
              <span className="inline sm:hidden">{formatOccurrenceDateShort(date)}</span>
              {" · "}
              {formatTimeOfDay(listing.recurrenceStartTime!)}–{formatTimeOfDay(endTime)}
            </span>
            {spotsText && (
              <span
                className={cn(
                  "shrink-0 pl-3 text-xs",
                  !isFull && (date.getTime() === selected ? "text-primary-foreground/70" : "text-muted-foreground")
                )}
              >
                {spotsText}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
