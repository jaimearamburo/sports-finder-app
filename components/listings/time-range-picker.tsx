"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { startOfUTCDay } from "@/lib/dates";
import { formatTimeOfDay, minutesSinceMidnight } from "@/lib/time-of-day";
import type { PickerListing, SelectedSlots } from "./picker-types";

const CHIP_CLASS =
  "shrink-0 rounded-md border px-3 py-2 text-sm font-medium transition-colors";
const CHIP_UNSELECTED = "border-border bg-card text-muted-foreground hover:border-foreground/50 hover:text-foreground";
const CHIP_SELECTED = "border-primary bg-primary text-primary-foreground";

function formatDateChip(date: Date): string {
  return date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

function minutesToTimeString(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// Order matters: date, then duration, then start time - duration decides
// which start times even fit before closing, so picking it first lets the
// time grid only ever show valid options instead of letting someone pick
// a time and then discover their duration doesn't fit there.
export function TimeRangePicker({
  listing,
  bookableDates,
  onSelect,
}: {
  listing: PickerListing;
  bookableDates: Date[];
  onSelect: (slots: SelectedSlots | null) => void;
}) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [selectedStartMinutes, setSelectedStartMinutes] = useState<number | null>(null);

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

  // TODO: Implement the start time conflict check in the UI.
  // ie. don't show an available start time for the user to select 
  // if the start time can't fit the selected duration (due to an existing booking or venue closing or an override block exists)
  const timeOptions: number[] = [];
  if (
    selectedDuration &&
    listing.operatingHoursStart &&
    listing.operatingHoursEnd &&
    listing.incrementMinutes
  ) {
    const openMinutes = minutesSinceMidnight(listing.operatingHoursStart);
    const closeMinutes = minutesSinceMidnight(listing.operatingHoursEnd);
    for (let t = openMinutes; t + selectedDuration <= closeMinutes; t += listing.incrementMinutes) {
      timeOptions.push(t);
    }
  }

  function pickDate(date: Date) {
    setSelectedDate(date);
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
    if (!selectedDate || !selectedDuration) return;
    setSelectedStartMinutes(startMinutes);
    const startsAt = new Date(
      Date.UTC(
        selectedDate.getUTCFullYear(),
        selectedDate.getUTCMonth(),
        selectedDate.getUTCDate(),
        Math.floor(startMinutes / 60),
        startMinutes % 60
      )
    );
    onSelect([{ startsAt, endsAt: new Date(startsAt.getTime() + selectedDuration * 60000) }]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Date</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {bookableDates.map((date) => (
            <button
              key={date.getTime()}
              type="button"
              onClick={() => pickDate(date)}
              className={cn(
                CHIP_CLASS,
                startOfUTCDay(date).getTime() === selectedDate?.getTime() ? CHIP_SELECTED : CHIP_UNSELECTED
              )}
            >
              {formatDateChip(date)}
            </button>
          ))}
        </div>
      </div>

      {selectedDate && durationOptions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Duration</p>
          <div className="flex gap-2">
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
          {timeOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No start times fit that duration on this date.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {timeOptions.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => pickStartTime(minutes)}
                  className={cn(
                    CHIP_CLASS,
                    minutes === selectedStartMinutes ? CHIP_SELECTED : CHIP_UNSELECTED
                  )}
                >
                  {formatTimeOfDay(minutesToTimeString(minutes))}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
