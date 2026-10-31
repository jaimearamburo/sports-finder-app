import type { PickerListing, SelectedSlots } from "@/components/listings/picker-types";

// Plain pricing maths shared by SlotPicker (client) and the checkout page
// (server). Kept out of slot-picker.tsx because server code can't call a "use
// client" module's exports.

// Scales pricePerUnit (per hour, per day or per session, by mechanic) to each
// slot and sums them. Quantity isn't handled here: callers multiply the result.
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

// A class is one flat-rate session, so it has no breakdown line.
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
