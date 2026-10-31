"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { localDateToUTCDay } from "@/lib/dates";
import { formatTimeOfDay, minutesSinceMidnight, zonedOccurrenceStart, isPastToday } from "@/lib/time-of-day";
import { Calendar } from "@/components/ui/calendar";
import type { OccupiedInterval } from "@/lib/availability";
import type { PickerListing, SelectedSlots } from "./picker-types";

const CHIP_CLASS =
  "shrink-0 rounded-md border px-3 py-2 text-sm font-medium transition-colors";
const CHIP_UNSELECTED = "border-border bg-card text-muted-foreground hover:border-foreground/50 hover:text-foreground";
const CHIP_SELECTED = "border-primary bg-primary text-primary-foreground";
const CHIP_DISABLED = "cursor-not-allowed border-border bg-card text-muted-foreground opacity-40";

// en-US for "October 6, 2026" ordering.
function formatFullDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function minutesToTimeString(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// Pick date, then length, then start time: the length decides which start times
// fit before closing.
export function TimeRangePicker({
  listing,
  bookableDates,
  occupiedIntervals,
  onSelect,
}: {
  listing: PickerListing;
  bookableDates: Date[];
  // Occupied ranges per date (getOccupiedIntervals). Undefined is treated as
  // none.
  occupiedIntervals?: Map<number, OccupiedInterval[]>;
  onSelect: (slots: SelectedSlots | null) => void;
}) {
  // Defaults to the earliest bookable date.
  const [selectedDate, setSelectedDate] = useState<Date | null>(bookableDates[0] ?? null);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [selectedStartMinutes, setSelectedStartMinutes] = useState<number | null>(null);

  const bookableSet = useMemo(() => new Set(bookableDates.map((d) => d.getTime())), [bookableDates]);
  const isDateDisabled = (date: Date) => !bookableSet.has(localDateToUTCDay(date).getTime());

  const durationOptions: number[] = [];
  if (listing.minDurationMinutes && listing.maxDurationMinutes) {
    if (listing.incrementMinutes) {
      for (let d = listing.minDurationMinutes; d <= listing.maxDurationMinutes; d += listing.incrementMinutes) {
        durationOptions.push(d);
      }
    } else {
      durationOptions.push(listing.minDurationMinutes, listing.maxDurationMinutes);
    }
  }

  // Every step-aligned start time across opening hours, independent of the
  // selected length, so the grid keeps its layout when the length changes;
  // fitsDuration decides each button's state.
  const allStartMinutes: number[] = [];
  if (listing.operatingHoursStart && listing.operatingHoursEnd && listing.incrementMinutes) {
    const openMinutes = minutesSinceMidnight(listing.operatingHoursStart);
    const closeMinutes = minutesSinceMidnight(listing.operatingHoursEnd);
    for (let t = openMinutes; t < closeMinutes; t += listing.incrementMinutes) {
      allStartMinutes.push(t);
    }
  }

  function fitsDuration(startMinutes: number): boolean {
    if (!selectedDuration || !listing.operatingHoursEnd) return false;
    return startMinutes + selectedDuration <= minutesSinceMidnight(listing.operatingHoursEnd);
  }

  // Whether bookings and holds already use the listing's capacity anywhere in
  // [start, start + length): the picker's mirror of createBookingHold's check.
  // Unlimited capacity skips it. Quantity isn't known yet, so this blocks only
  // when capacity is fully used; the server still enforces quantity.
  function hasConflict(startMinutes: number): boolean {
    if (!selectedDate || !selectedDuration || listing.capacity === null) return false;
    const dayIntervals = occupiedIntervals?.get(selectedDate.getTime()) ?? [];
    const endMinutes = startMinutes + selectedDuration;
    const used = dayIntervals
      .filter((interval) => interval.startMinutes < endMinutes && interval.endMinutes > startMinutes)
      .reduce((sum, interval) => sum + interval.quantity, 0);
    return used >= listing.capacity;
  }

  // Start times that have passed today (venue clock) aren't selectable; the
  // server applies the same rule.
  function isSelectable(startMinutes: number): boolean {
    if (!fitsDuration(startMinutes)) return false;
    if (selectedDate && isPastToday(selectedDate, startMinutes, listing.venueTimezone)) return false;
    if (hasConflict(startMinutes)) return false;
    return true;
  }

  function pickDate(date: Date) {
    // localDateToUTCDay: the calendar returns local midnight, and startOfUTCDay
    // would shift it back a day east of UTC.
    setSelectedDate(localDateToUTCDay(date));
    setSelectedDuration(null);
    setSelectedStartMinutes(null);
    onSelect(null);
  }

  function pickDuration(duration: number) {
    setSelectedDuration(duration);
    setSelectedStartMinutes(null);
    onSelect(null);
  }

  function pickStartTime(startMinutes: number) {
    if (!selectedDate || !selectedDuration || !isSelectable(startMinutes)) return;
    setSelectedStartMinutes(startMinutes);
    // The chosen time is venue wall-clock time, not UTC.
    const startsAt = zonedOccurrenceStart(selectedDate, minutesToTimeString(startMinutes), listing.venueTimezone);
    onSelect([{ startsAt, endsAt: new Date(startsAt.getTime() + selectedDuration * 60000) }]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        {selectedDate && (
          <p className="text-lg mb-2 font-semibold text-foreground">Availability for {formatFullDate(selectedDate)}</p>
        )}
        <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Date</p>
        <Calendar
          mode="single"
          selected={selectedDate ?? undefined}
          onSelect={(date) => date && pickDate(date)}
          disabled={isDateDisabled}
          className="rounded-md border"
        />
      </div>

      {selectedDate && durationOptions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Duration</p>
          <div className="flex flex-wrap gap-2">
            {durationOptions.map((duration) => (
              <button
                key={duration}
                type="button"
                onClick={() => pickDuration(duration)}
                className={cn(CHIP_CLASS, duration === selectedDuration ? CHIP_SELECTED : CHIP_UNSELECTED)}
              >
                {duration} min
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedDuration !== null && (
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Start time</p>
          {allStartMinutes.length === 0 ? (
            <p className="text-sm text-muted-foreground">This listing has no schedule configured.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {allStartMinutes.map((minutes) => {
                const disabled = !isSelectable(minutes);
                const conflict = disabled && hasConflict(minutes);
                return (
                  <button
                    key={minutes}
                    type="button"
                    disabled={disabled}
                    title={conflict ? "Already booked" : undefined}
                    onClick={() => pickStartTime(minutes)}
                    className={cn(
                      CHIP_CLASS,
                      disabled ? CHIP_DISABLED : minutes === selectedStartMinutes ? CHIP_SELECTED : CHIP_UNSELECTED
                    )}
                  >
                    {formatTimeOfDay(minutesToTimeString(minutes))}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
