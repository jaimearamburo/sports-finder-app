"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { localDateToUTCDay } from "@/lib/dates";
import { formatTimeOfDay, minutesSinceMidnight, zonedOccurrenceStart } from "@/lib/time-of-day";
import { Calendar } from "@/components/ui/calendar";
import type { PickerListing, SelectedSlots } from "./picker-types";

const CHIP_CLASS =
  "shrink-0 rounded-md border px-3 py-2 text-sm font-medium transition-colors";
const CHIP_UNSELECTED = "border-border bg-card text-muted-foreground hover:border-foreground/50 hover:text-foreground";
const CHIP_SELECTED = "border-primary bg-primary text-primary-foreground";
const CHIP_DISABLED = "cursor-not-allowed border-border bg-card text-muted-foreground opacity-40";

// en-US, not this file's usual en-AU, for month-day-year ordering with a
// comma ("October 6, 2026") rather than en-AU's day-first "6 October 2026".
function formatFullDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
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
  // Defaults to the earliest bookable date (ordinarily today, unless an
  // override blocks it) rather than requiring an explicit first click.
  const [selectedDate, setSelectedDate] = useState<Date | null>(bookableDates[0] ?? null);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [selectedStartMinutes, setSelectedStartMinutes] = useState<number | null>(null);

  // A time_range listing is bookable (almost always) every day, so an
  // always-visible calendar - the same pattern DateRangePicker already
  // uses - reads better here than a horizontally-scrolling pill row: no
  // second UI to keep in sync with the calendar, no auto-scroll-to-
  // selection to build, and one less thing that can drift out of
  // agreement with itself.
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

  // Every increment-aligned start time across the whole operating window,
  // independent of which duration is currently selected - this list's
  // length/order never changes when duration changes, only each button's
  // own fits-the-current-duration state does (see fitsDuration below). A
  // duration-dependent list would shrink or grow the grid on every
  // duration change, shifting every other button's position and forcing
  // the user to re-find whichever one they were about to click.
  const allStartMinutes: number[] = [];
  if (listing.operatingHoursStart && listing.operatingHoursEnd && listing.incrementMinutes) {
    const openMinutes = minutesSinceMidnight(listing.operatingHoursStart);
    const closeMinutes = minutesSinceMidnight(listing.operatingHoursEnd);
    for (let t = openMinutes; t < closeMinutes; t += listing.incrementMinutes) {
      allStartMinutes.push(t);
    }
  }

  // TODO: Implement the start time conflict check in the UI.
  // ie. a start time should also disable (same as a duration that doesn't
  // fit, below) if it can't actually fit the selected duration due to an
  // existing booking, the venue closing, or an override block - none of
  // that is checked yet, only whether it fits before closing time.
  function fitsDuration(startMinutes: number): boolean {
    if (!selectedDuration || !listing.operatingHoursEnd) return false;
    return startMinutes + selectedDuration <= minutesSinceMidnight(listing.operatingHoursEnd);
  }

  function pickDate(date: Date) {
    // localDateToUTCDay, not startOfUTCDay: the Calendar hands back a Date
    // built from the browser's LOCAL midnight for the clicked day.
    // startOfUTCDay would reinterpret that instant through UTC's clock
    // (wrong tool here - see its own comment in lib/dates.ts), silently
    // shifting the day back by one for anyone east of UTC (e.g.
    // Australia). Without the right conversion, selectedDate could
    // disagree with bookableDates' own UTC-midnight entries by a day,
    // corrupting the startsAt pickStartTime builds below.
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
    if (!selectedDate || !selectedDuration || !fitsDuration(startMinutes)) return;
    setSelectedStartMinutes(startMinutes);
    // zonedOccurrenceStart, not Date.UTC directly - the chosen time is a
    // wall-clock time at the venue, not at UTC (see its own comment in
    // lib/time-of-day.ts).
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
          {allStartMinutes.length === 0 ? (
            <p className="text-sm text-muted-foreground">This listing has no schedule configured.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {allStartMinutes.map((minutes) => {
                const disabled = !fitsDuration(minutes);
                return (
                  <button
                    key={minutes}
                    type="button"
                    disabled={disabled}
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
