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
  occupiedIntervals,
  onSelect,
}: {
  listing: PickerListing;
  bookableDates: Date[];
  // Per-date occupied ranges from existing Bookings/BookingHolds - see
  // getOccupiedIntervals in lib/availability.ts. Undefined means "nothing
  // fetched" and is treated as "nothing occupied," never as "unknown."
  occupiedIntervals?: Map<number, OccupiedInterval[]>;
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

  function fitsDuration(startMinutes: number): boolean {
    if (!selectedDuration || !listing.operatingHoursEnd) return false;
    return startMinutes + selectedDuration <= minutesSinceMidnight(listing.operatingHoursEnd);
  }

  // Whether an existing Booking/BookingHold already claims enough of this
  // listing's capacity, somewhere in [startMinutes, startMinutes +
  // selectedDuration), that this start time can't actually be booked - the
  // picker's own mirror of the overlap-sum check createBookingHold enforces
  // server-side. capacity: null (unlimited) skips the check entirely, same
  // as the server does. Every seeded time_range listing is capacity: 1, so
  // "used >= capacity" (rather than factoring in a not-yet-chosen quantity,
  // which this component has no access to - SlotPicker's quantity stepper
  // only appears after a slot is picked) is exactly right for the
  // exclusive-use case this app actually has; a future capacity > 1
  // time_range listing would still be correctly blocked server-side even
  // if this client-side check under-blocks it slightly.
  function hasConflict(startMinutes: number): boolean {
    if (!selectedDate || !selectedDuration || listing.capacity === null) return false;
    const dayIntervals = occupiedIntervals?.get(selectedDate.getTime()) ?? [];
    const endMinutes = startMinutes + selectedDuration;
    const used = dayIntervals
      .filter((interval) => interval.startMinutes < endMinutes && interval.endMinutes > startMinutes)
      .reduce((sum, interval) => sum + interval.quantity, 0);
    return used >= listing.capacity;
  }

  // A start time on today's date that's already passed (measured against
  // the venue's own clock, not the browser's) is never selectable, even
  // if it would otherwise fit. The server re-derives this same rule
  // independently in isRequestedSlotValid - this is purely so the picker
  // doesn't offer something it already knows will be rejected.
  function isSelectable(startMinutes: number): boolean {
    if (!fitsDuration(startMinutes)) return false;
    if (selectedDate && isPastToday(selectedDate, startMinutes, listing.venueTimezone)) return false;
    if (hasConflict(startMinutes)) return false;
    return true;
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
    if (!selectedDate || !selectedDuration || !isSelectable(startMinutes)) return;
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
