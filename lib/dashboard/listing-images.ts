import "server-only";
import { del, head } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { withPermission } from "@/lib/auth-guards";
import { canManageVenue } from "@/lib/authz/policies";
import { isListingImageType, isUploadPathnameForVenue, isVenueImageUrl } from "@/lib/listing-images";

const VENUE_NOT_FOUND = "This venue doesn't exist, or it isn't one you manage.";

export type UploadPermissionResult = { ok: true } | { ok: false; error: string };

// Whether this user may upload a listing photo to `pathname` for this
// venue: the same permission and ownership check as editing the venue's
// listings, and only to that venue's own folder (see listing-images.ts).
// The upload route gives out a one-time upload permission only when this
// says yes; the Blob token itself is never sent to the browser.
//
// By venue rather than listing, because a new listing's photo is uploaded
// before the listing exists. Owning the venue is what owning any of its
// listings means anyway (canManageListing).
export const authorizeListingImageUpload = withPermission(
  "venues:manage",
  async (session, venueId: unknown, pathname: unknown): Promise<UploadPermissionResult> => {
    if (typeof venueId !== "string" || venueId.length === 0 || venueId.length > 64) {
      return { ok: false, error: VENUE_NOT_FOUND };
    }
    const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true, ownerId: true } });
    if (!venue || !canManageVenue(session.user, venue)) return { ok: false, error: VENUE_NOT_FOUND };
    if (typeof pathname !== "string" || !isUploadPathnameForVenue(pathname, venue.id)) {
      return { ok: false, error: "That isn't a valid image name." };
    }
    return { ok: true };
  }
);

// Checks an image URL a listing save wants to store, for a venue the
// caller has already been checked against: it must be a photo in that
// venue's folder in our store, and the file must really be there with an
// allowed type (a crafted URL in the right folder that was never uploaded
// would otherwise show as a broken image). Returns an error for the form,
// or null when it's fine.
export async function checkVenueImageUrl(url: string, venueId: string): Promise<string | null> {
  const PROBLEM = "That photo couldn't be found. Upload it again.";
  if (!isVenueImageUrl(url, venueId)) return PROBLEM;
  try {
    const blob = await head(url);
    return isListingImageType(blob.contentType) ? null : PROBLEM;
  } catch {
    return PROBLEM;
  }
}

// Deletes a listing photo that a save has just replaced or removed. Best
// effort, after the listing is saved: a failure leaves an unused file in
// the store, never a listing pointing at a missing one, so it's logged
// rather than shown. Kept if any listing still uses it (only possible if
// one was saved with another's URL, which the folder check limits to the
// same venue).
export async function deleteReplacedListingImage(url: string): Promise<void> {
  try {
    const stillUsed = await prisma.listing.count({ where: { imageUrl: url } });
    if (stillUsed === 0) await del(url);
  } catch (error) {
    console.error("Couldn't delete a replaced listing image", error);
  }
}
