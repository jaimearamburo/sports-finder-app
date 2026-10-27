import type { Activity, Listing } from "../generated/prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

type SlotSetListing = Pick<Listing, "minDurationDays" | "maxDurationDays"> & {
  activity: Pick<Activity, "bookingMechanic" | "isAccommodation">;
};

// Whether the *set* of slots in one hold request has a legal shape for
// this listing - complementing isRequestedSlotValid (lib/availability.ts),
// which only judges each slot on its own. Without this, the server took
// the picker UI's word for how many slots a request contains: a crafted
// request could hold dozens of court slots under one order (sidestepping
// the one-active-hold-per-user rule, which counts orders, not slots), or
// book a "1-5 day pass" for 20 days, since each picked day is
// individually a valid one-day slot.
//   - time_range, fixed_session, accommodation date_range: exactly one
//     slot, the only thing their pickers can ever produce.
//   - a pass (non-accommodation date_range): one slot per picked day,
//     each exactly one calendar day, no day twice, and a day count within
//     minDurationDays..maxDurationDays - the same bounds DateRangePicker's
//     calendar applies.
// Pure (no database access) so it's testable in isolation.
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
