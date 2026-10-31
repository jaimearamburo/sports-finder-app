import type { Activity, Listing } from "../generated/prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

type SlotSetListing = Pick<Listing, "minDurationDays" | "maxDurationDays"> & {
  activity: Pick<Activity, "bookingMechanic" | "isAccommodation">;
};

// Whether the set of slots in one hold request has a legal shape for this
// listing. isRequestedSlotValid checks each slot alone; this stops a crafted
// request holding many court slots under one order, or a 1-5 day pass for 20
// days.
// - Courts, classes and stays: exactly one slot.
// - Passes (non-accommodation date_range): one slot per picked day, each
//   exactly one calendar day, no repeats, and a count within
//   minDurationDays..maxDurationDays.
export function isSlotSetValid(listing: SlotSetListing, slots: { startsAt: Date; endsAt: Date }[]): boolean {
  const isPass = listing.activity.bookingMechanic === "date_range" && !listing.activity.isAccommodation;
  if (!isPass) return slots.length === 1;

  const min = listing.minDurationDays ?? 1;
  const max = listing.maxDurationDays ?? min;
  if (slots.length < min || slots.length > max) return false;

  const days = new Set<number>();
  for (const slot of slots) {
    if (slot.endsAt.getTime() - slot.startsAt.getTime() !== DAY_MS) return false;
    days.add(slot.startsAt.getTime());
  }
  return days.size === slots.length;
}
