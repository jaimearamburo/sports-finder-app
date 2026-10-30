"use server";

import { createVenue, updateVenue } from "@/lib/dashboard/venues";
import type { VenueInput } from "@/lib/validation/venue";

export type { SaveVenueResult } from "@/lib/dashboard/venues";

// Thin on purpose, like app/listings/[id]/actions.ts: the permission and
// ownership checks, validation and writes all live in the data layer
// (lib/dashboard/venues.ts), so nothing calling these can skip them.
export async function createVenueAction(input: VenueInput) {
  return createVenue(input);
}

export async function updateVenueAction(venueId: string, input: VenueInput) {
  return updateVenue(venueId, input);
}
