"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startOfUTCDay } from "@/lib/dates";
import { TimeRangePicker } from "./time-range-picker";
import { DateRangePicker } from "./date-range-picker";
import { FixedSessionPicker } from "./fixed-session-picker";
import type { PickerListing, SelectedSlots } from "./picker-types";

// pricePerUnit is a per-hour/per-day/flat-per-session rate depending on
// mechanic (see getPriceSuffix in listing-card.tsx). This scales each
// slot into an actual cost and sums across all of them. Every mechanic
// except a non-accommodation date_range pass only ever produces one slot.
// Quantity (how many people/units one purchase claims) is deliberately not
// handled here - SlotPicker multiplies this function's result by quantity
// once, at the top level, so this stays ignorant of it.
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
// spans. Submitting the selection to bookListingAction
// (app/listings/[id]/actions.ts) is out of scope here; this only gets the
// user to a valid, visible selection.
export function SlotPicker({
  listing,
  bookableDates,
  spotsRemaining,
}: {
  listing: PickerListing;
  bookableDates: Date[];
  // fixed_session only - see getSpotsRemaining in lib/availability.ts.
  // Undefined for the other two mechanics, which have no such concept.
  spotsRemaining?: Map<number, number | null>;
}) {
  const [slots, setSlots] = useState<SelectedSlots | null>(null);
  const [quantity, setQuantity] = useState(1);

  // Resets quantity back to 1 whenever the slot selection itself changes,
  // using React's documented "adjust state during render" pattern rather
  // than a useEffect - a fresh selection might not even support the
  // previous quantity (a different occurrence could have fewer spots
  // left), so the stale value is dropped rather than re-validated.
  const [prevSlots, setPrevSlots] = useState(slots);
  if (slots !== prevSlots) {
    setPrevSlots(slots);
    setQuantity(1);
  }

  if (bookableDates.length === 0) {
    return <p className="text-sm text-muted-foreground">No upcoming availability right now.</p>;
  }

  // A capacity-1 listing (the typical exclusive-use court) has no room for
  // a group booking at all, so the stepper doesn't even render for it -
  // null (unlimited) and any capacity above 1 both get one.
  const showQuantityStepper = listing.capacity === null || listing.capacity > 1;

  // For fixed_session, also cap at the actually-selected occurrence's real
  // remaining spots, not just the listing's general limits - otherwise the
  // stepper would let someone pick a quantity that looks valid against
  // capacity/maxBookingsPerTransaction alone but exceeds what's actually
  // left for the specific class they picked (a class with 3 of 20 spots
  // open shouldn't let a 5-person request through just because the
  // listing's overall cap is 5). spotsRemaining is keyed by the
  // occurrence's calendar date, same convention as bookableDates, so the
  // selected slot's startsAt needs normalizing back to that same key.
  const selectedOccurrenceSpotsLeft =
    listing.bookingMechanic === "fixed_session" && slots && spotsRemaining
      ? spotsRemaining.get(startOfUTCDay(slots[0].startsAt).getTime())
      : undefined;
  const quantityMax = Math.min(
    listing.maxBookingsPerTransaction ?? Infinity,
    listing.capacity ?? Infinity,
    selectedOccurrenceSpotsLeft ?? Infinity
  );

  const total = slots ? getTotalPrice(listing, slots) * quantity : 0;
  const breakdown = slots ? getBreakdownLine(listing, slots) : null;
  const breakdownWithQuantity = breakdown && quantity > 1 ? `${breakdown} × ${quantity}` : breakdown;

  return (
    <div className="flex flex-col gap-4">
      {listing.bookingMechanic === "time_range" && (
        <TimeRangePicker listing={listing} bookableDates={bookableDates} onSelect={setSlots} />
      )}
      {listing.bookingMechanic === "date_range" && (
        <DateRangePicker listing={listing} bookableDates={bookableDates} onSelect={setSlots} />
      )}
      {listing.bookingMechanic === "fixed_session" && (
        <FixedSessionPicker
          listing={listing}
          bookableDates={bookableDates}
          spotsRemaining={spotsRemaining}
          onSelect={setSlots}
        />
      )}

      {/* Always rendered, never conditionally hidden - a running total of
          $0.00 before a selection reads as "nothing to pay yet," which is
          more checkout-like than a placeholder that disappears the moment
          something is picked. */}
      <div className="flex items-center justify-between border-t pt-4">
        <p className="text-sm text-muted-foreground">{breakdownWithQuantity ?? "Total"}</p>
        <div className="flex items-center gap-4">
          {showQuantityStepper && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                disabled={!slots || quantity <= 1}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
              >
                <Minus />
              </Button>
              <span className="w-4 text-center text-sm font-medium tabular-nums">{quantity}</span>
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                disabled={!slots || quantity >= quantityMax}
                onClick={() => setQuantity((q) => Math.min(quantityMax, q + 1))}
                aria-label="Increase quantity"
              >
                <Plus />
              </Button>
            </div>
          )}
          <p className="font-mono text-xl font-semibold">{total === 0 ? "$0.00" : `$${total.toFixed(2)}`}</p>
        </div>
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
