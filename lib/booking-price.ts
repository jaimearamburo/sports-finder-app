import type { PickerListing, SelectedSlots } from "@/components/listings/picker-types";

// Plain pricing math with no client/browser dependency, so both SlotPicker
// (client-side, for the live running total) and the checkout page (a
// Server Component) can call it directly - a "use client" file's exports
// are replaced with client references when imported elsewhere, so calling
// one directly from server code (rather than rendering it as JSX) throws
// at runtime, which is why this can't live in slot-picker.tsx itself.

// pricePerUnit is a per-hour/per-day/flat-per-session rate depending on
// mechanic (see getPriceSuffix in listing-card.tsx). This scales each
// slot into an actual cost and sums across all of them. Every mechanic
// except a non-accommodation date_range pass only ever produces one slot.
// Quantity (how many people/units one purchase claims) is deliberately not
// handled here - callers multiply this function's result by quantity
// once, at the top level, so this stays ignorant of it.
export function getTotalPrice(
  listing: Pick<PickerListing, "bookingMechanic" | "pricePerUnit">,
  slots: SelectedSlots
): number {
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

// fixed_session is always exactly one flat-rate session with no
// duration/quantity axis to break down, so it gets no breakdown line.
export function getBreakdownLine(
  listing: Pick<PickerListing, "bookingMechanic" | "pricePerUnit" | "isAccommodation">,
  slots: SelectedSlots
): string | null {
  if (slots.length === 0) return null;

  switch (listing.bookingMechanic) {
    case "time_range": {
      const hours = slots.reduce(
        (sum, s) => sum + (s.endsAt.getTime() - s.startsAt.getTime()) / (60 * 60 * 1000),
        0
      );
      const hoursLabel = hours % 1 === 0 ? hours.toString() : hours.toFixed(1);
      return `${hoursLabel} hr${hours === 1 ? "" : "s"} × $${listing.pricePerUnit.toFixed(2)}`;
    }
    case "date_range": {
      const totalDays = slots.reduce(
        (sum, s) => sum + (s.endsAt.getTime() - s.startsAt.getTime()) / (24 * 60 * 60 * 1000),
        0
      );
      const unit = listing.isAccommodation ? "night" : "day";
      return `${totalDays} ${unit}${totalDays === 1 ? "" : "s"} × $${listing.pricePerUnit.toFixed(2)}`;
    }
    case "fixed_session":
      return null;
  }
}
