"use server";

import { setListingArchived } from "@/lib/dashboard/listings";

export type { ArchiveListingResult } from "@/lib/dashboard/listings";

// Thin on purpose: the permission and ownership checks and the write live
// in the data layer (lib/dashboard/listings.ts).
export async function setListingArchivedAction(listingId: string, archived: boolean) {
  return setListingArchived(listingId, archived);
}
