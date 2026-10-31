"use server";

import { createVenue, updateVenue } from "@/lib/dashboard/venues";
import type { VenueInput } from "@/lib/validation/venue";

export type { SaveVenueResult } from "@/lib/dashboard/venues";

// Thin: permission, ownership, validation and writes live in
// lib/dashboard/venues.ts, so no caller can skip them.
export async function createVenueAction(input: VenueInput) {
  return createVenue(input);
}

export async function updateVenueAction(venueId: string, input: VenueInput) {
  return updateVenue(venueId, input);
}
