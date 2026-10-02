"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TimeRangePicker } from "./time-range-picker";
import { DateRangePicker } from "./date-range-picker";
import { FixedSessionPicker } from "./fixed-session-picker";
import type { PickerListing, SelectedSlot } from "./picker-types";

// pricePerUnit is a per-hour/per-day/flat-per-session rate depending on
// mechanic (see getPriceSuffix in listing-card.tsx) - this scales it into
// an actual total for the slot the user is looking at right now.
function getTotalPrice(listing: PickerListing, slot: SelectedSlot): number {
  const durationMs = slot.endsAt.getTime() - slot.startsAt.getTime();
  switch (listing.bookingMechanic) {
    case "time_range":
      return listing.pricePerUnit * (durationMs / (60 * 60 * 1000));
    case "date_range":
      return listing.pricePerUnit * (durationMs / (24 * 60 * 60 * 1000));
    case "fixed_session":
      return listing.pricePerUnit;
  }
}

// Picks the mechanic-specific picker and owns the one piece of state every
// mechanic eventually produces the same shape of: a concrete startsAt/
// endsAt. Submitting that (ticket 5.3 - bookListingAction already exists
// and works, it just has nothing calling it yet) is deliberately out of
// scope here; this only gets the user to a valid, visible selection.
export function SlotPicker({ listing, bookableDates }: { listing: PickerListing; bookableDates: Date[] }) {
  const [slot, setSlot] = useState<SelectedSlot | null>(null);

  if (bookableDates.length === 0) {
    return <p className="text-sm text-muted-foreground">No upcoming availability right now.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {listing.bookingMechanic === "time_range" && (
        <TimeRangePicker listing={listing} bookableDates={bookableDates} onSelect={setSlot} />
      )}
      {listing.bookingMechanic === "date_range" && (
        <DateRangePicker listing={listing} bookableDates={bookableDates} onSelect={setSlot} />
      )}
      {listing.bookingMechanic === "fixed_session" && (
        <FixedSessionPicker listing={listing} bookableDates={bookableDates} onSelect={setSlot} />
      )}

      <div className="flex items-center justify-between border-t pt-4">
        <p className="text-sm text-muted-foreground">
          {slot ? "Total" : "Select a slot to see the price"}
        </p>
        {slot && (
          <p className="font-mono text-xl font-semibold">
            {getTotalPrice(listing, slot) === 0 ? "Free" : `$${getTotalPrice(listing, slot).toFixed(2)}`}
          </p>
        )}
      </div>

      {/* Stays disabled regardless of selection - there's nothing wired
          to submit to yet (ticket 5.3). An enabled button that silently
          does nothing on click would be worse than an honestly disabled
          one; the live price above is this ticket's actual payoff. */}
      <Button disabled className="w-full" size="lg">
        Booking coming soon
      </Button>
    </div>
  );
}
