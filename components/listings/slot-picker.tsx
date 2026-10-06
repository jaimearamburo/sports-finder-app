"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TimeRangePicker } from "./time-range-picker";
import { DateRangePicker } from "./date-range-picker";
import { FixedSessionPicker } from "./fixed-session-picker";
import type { PickerListing, SelectedSlots } from "./picker-types";

// pricePerUnit is a per-hour/per-day/flat-per-session rate depending on
// mechanic (see getPriceSuffix in listing-card.tsx) - this scales each
// slot into an actual cost and sums across all of them. Every mechanic
// except a non-accommodation date_range pass only ever produces one slot,
// so this reduces to the same single-slot math as before for those.
function getTotalPrice(listing: PickerListing, slots: SelectedSlots): number {
  return slots.reduce((sum, slot) => {
    const durationMs = slot.endsAt.getTime() - slot.startsAt.getTime();
    switch (listing.bookingMechanic) {
      case "time_range":
        return sum + listing.pricePerUnit * (durationMs / (60 * 60 * 1000));
      case "date_range":
        return sum + listing.pricePerUnit * (durationMs / (24 * 60 * 60 * 1000));
      case "fixed_session":
        return sum + listing.pricePerUnit;
    }
  }, 0);
}

// Only date_range gets a breakdown for now - time_range's duration-based
// price is already visible via its own picker, and fixed_session is
// always exactly one flat-rate session, so neither needs one yet.
function getBreakdownLine(listing: PickerListing, slots: SelectedSlots): string | null {
  if (listing.bookingMechanic !== "date_range" || slots.length === 0) return null;
  const totalDays = slots.reduce(
    (sum, s) => sum + (s.endsAt.getTime() - s.startsAt.getTime()) / (24 * 60 * 60 * 1000),
    0
  );
  const unit = listing.isAccommodation ? "night" : "day";
  return `${totalDays} ${unit}${totalDays === 1 ? "" : "s"} × $${listing.pricePerUnit.toFixed(2)}`;
}

// Picks the mechanic-specific picker and owns the one piece of state every
// mechanic eventually produces: one or more concrete startsAt/endsAt
// spans. Submitting that (ticket 5.3 - bookListingAction already exists
// and works, it just has nothing calling it yet) is deliberately out of
// scope here; this only gets the user to a valid, visible selection.
export function SlotPicker({ listing, bookableDates }: { listing: PickerListing; bookableDates: Date[] }) {
  const [slots, setSlots] = useState<SelectedSlots | null>(null);

  if (bookableDates.length === 0) {
    return <p className="text-sm text-muted-foreground">No upcoming availability right now.</p>;
  }

  const total = slots ? getTotalPrice(listing, slots) : 0;
  const breakdown = slots ? getBreakdownLine(listing, slots) : null;

  return (
    <div className="flex flex-col gap-4">
      {listing.bookingMechanic === "time_range" && (
        <TimeRangePicker listing={listing} bookableDates={bookableDates} onSelect={setSlots} />
      )}
      {listing.bookingMechanic === "date_range" && (
        <DateRangePicker listing={listing} bookableDates={bookableDates} onSelect={setSlots} />
      )}
      {listing.bookingMechanic === "fixed_session" && (
        <FixedSessionPicker listing={listing} bookableDates={bookableDates} onSelect={setSlots} />
      )}

      {/* Always rendered, never conditionally hidden - a running total of
          $0.00 before a selection reads as "nothing to pay yet," which is
          more checkout-like than the old "select a slot" placeholder text
          that disappeared the moment something was picked. */}
      <div className="flex items-center justify-between border-t pt-4">
        <p className="text-sm text-muted-foreground">{breakdown ?? "Total"}</p>
        <p className="font-mono text-xl font-semibold">{total === 0 ? "$0.00" : `$${total.toFixed(2)}`}</p>
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
