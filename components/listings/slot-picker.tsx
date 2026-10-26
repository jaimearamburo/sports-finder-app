"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startOfUTCDay } from "@/lib/dates";
import { TimeRangePicker } from "./time-range-picker";
import { DateRangePicker } from "./date-range-picker";
import { FixedSessionPicker } from "./fixed-session-picker";
import { createBookingHoldAction } from "@/app/listings/[id]/actions";
import { getTotalPrice, getBreakdownLine } from "@/lib/booking-price";
import type { OccupiedInterval } from "@/lib/availability";
import type { PickerListing, SelectedSlots } from "./picker-types";

// Picks the mechanic-specific picker and owns the one piece of state every
// mechanic eventually produces: one or more concrete startsAt/endsAt
// spans, plus submitting that selection to createBookingHoldAction and
// moving on to the checkout page once a hold is secured.
export function SlotPicker({
  listingId,
  listing,
  bookableDates,
  spotsRemaining,
  occupiedIntervals,
  fullyBookedDates,
}: {
  listingId: string;
  listing: PickerListing;
  bookableDates: Date[];
  // fixed_session only - see getSpotsRemaining in lib/availability.ts.
  // Undefined for the other two mechanics, which have no such concept.
  spotsRemaining?: Map<number, number | null>;
  // time_range only - see getOccupiedIntervals in lib/availability.ts.
  occupiedIntervals?: Map<number, OccupiedInterval[]>;
  // date_range only - see getFullyBookedDates in lib/availability.ts.
  fullyBookedDates?: Date[];
}) {
  const router = useRouter();
  const [slots, setSlots] = useState<SelectedSlots | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  function handleBookNow() {
    if (!slots) return;
    setError(null);
    startTransition(async () => {
      const result = await createBookingHoldAction({ listingId, slots, quantity });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/listings/${listingId}/checkout/${result.orderId}`);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {listing.bookingMechanic === "time_range" && (
        <TimeRangePicker
          listing={listing}
          bookableDates={bookableDates}
          occupiedIntervals={occupiedIntervals}
          onSelect={setSlots}
        />
      )}
      {listing.bookingMechanic === "date_range" && (
        <DateRangePicker
          listing={listing}
          bookableDates={bookableDates}
          fullyBookedDates={fullyBookedDates}
          onSelect={setSlots}
        />
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

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button disabled={!slots || isPending} onClick={handleBookNow} className="w-full" size="lg">
        Book Now
      </Button>
    </div>
  );
}
