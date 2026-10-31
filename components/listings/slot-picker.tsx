"use client";

import Link from "next/link";
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

// Renders the mechanic's picker, owns the selected slots and quantity, and
// submits them to createBookingHoldAction, then opens checkout.
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
  // fixed_session only (getSpotsRemaining).
  spotsRemaining?: Map<number, number | null>;
  // time_range only (getOccupiedIntervals).
  occupiedIntervals?: Map<number, OccupiedInterval[]>;
  // date_range only (getFullyBookedDates).
  fullyBookedDates?: Date[];
}) {
  const router = useRouter();
  const [slots, setSlots] = useState<SelectedSlots | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Reset quantity to 1 when the selection changes ("adjust state during
  // render", not an effect): the new slot may have fewer spots left.
  const [prevSlots, setPrevSlots] = useState(slots);
  if (slots !== prevSlots) {
    setPrevSlots(slots);
    setQuantity(1);
  }

  if (bookableDates.length === 0) {
    return <p className="text-sm text-muted-foreground">No upcoming availability right now.</p>;
  }

  // No stepper for capacity 1; shown for unlimited or capacity above 1.
  const showQuantityStepper = listing.capacity === null || listing.capacity > 1;

  // Classes are also capped by the selected occurrence's remaining spots.
  // spotsRemaining is keyed by calendar day, so the slot's start is normalised
  // to its UTC day.
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
    setNeedsLogin(false);
    startTransition(async () => {
      const result = await createBookingHoldAction({ listingId, slots, quantity });
      if (!result.ok) {
        if ("signedOut" in result && result.signedOut) setNeedsLogin(true);
        else setError(result.error);
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

      {/* Always shown: $0.00 before a selection reads as "nothing to pay yet". */}
      <div className="flex items-center justify-between border-t pt-4">
        <p className="text-sm text-muted-foreground">{breakdownWithQuantity ?? "Total"}</p>
        <div className="flex items-center gap-4">
          {showQuantityStepper && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                // Bigger on phones, where a 24px target is hard to hit.
                className="size-9 sm:size-6"
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
                className="size-9 sm:size-6"
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
      {/* Signed out: log in and return to this listing. The picked slot isn't
          kept; nothing is held until Book Now succeeds. */}
      {needsLogin && (
        <p className="text-sm text-destructive">
          You must{" "}
          <Link href={`/login?callbackUrl=${encodeURIComponent(`/listings/${listingId}`)}`} className="font-medium underline underline-offset-2">
            log in
          </Link>{" "}
          to make a booking.
        </p>
      )}

      <Button disabled={!slots || isPending} onClick={handleBookNow} className="w-full" size="lg">
        Book Now
      </Button>
    </div>
  );
}
