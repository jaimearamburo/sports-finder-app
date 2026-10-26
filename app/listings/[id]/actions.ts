"use server";

import { createBookingHold, finalizeBookingHold, releaseBookingHold } from "@/lib/bookings";

export type { CreateBookingHoldResult, FinalizeBookingHoldResult, ReleaseBookingHoldResult } from "@/lib/bookings";

// Thin on purpose - the real logic (auth check, availability re-validation,
// conflict-check transaction) lives in lib/bookings.ts's Data Access Layer,
// not here. Server Actions are reachable by direct POST request regardless
// of what UI calls them, so this file exists only to expose those DAL
// functions to the client, not to hold any of its own logic.
export async function createBookingHoldAction(input: {
  listingId: string;
  slots: { startsAt: Date; endsAt: Date }[];
  quantity?: number;
}) {
  return createBookingHold(input);
}

export async function finalizeBookingHoldAction(input: {
  orderId: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone?: string;
}) {
  return finalizeBookingHold(input);
}

export async function releaseBookingHoldAction(input: { orderId: string }) {
  return releaseBookingHold(input);
}
