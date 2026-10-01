"use server";

import { bookListing } from "@/lib/bookings";

export type { BookListingResult } from "@/lib/bookings";

// Thin on purpose - the real logic (auth check, availability re-validation,
// conflict-check transaction) lives in lib/bookings.ts's Data Access Layer,
// not here. Server Actions are reachable by direct POST request regardless
// of what UI calls them, so this file exists only to expose that DAL
// function to the client, not to hold any of its own logic.
export async function bookListingAction(input: {
  listingId: string;
  startsAt: Date;
  endsAt: Date;
  quantity?: number;
}) {
  return bookListing(input);
}
