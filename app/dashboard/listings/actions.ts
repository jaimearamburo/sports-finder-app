"use server";

import { createListing, setListingArchived, updateListing } from "@/lib/dashboard/listings";
import type { ListingFormInput } from "@/lib/validation/listing";

export type { ArchiveListingResult, SaveListingResult } from "@/lib/dashboard/listings";

// Thin: permission, ownership, validation and writes live in
// lib/dashboard/listings.ts, so no caller can skip them.
export async function setListingArchivedAction(listingId: string, archived: boolean) {
  return setListingArchived(listingId, archived);
}

export async function createListingAction(venueId: string, input: ListingFormInput) {
  return createListing(venueId, input);
}

export async function updateListingAction(listingId: string, input: ListingFormInput, confirmImpact: boolean) {
  return updateListing(listingId, input, confirmImpact);
}
