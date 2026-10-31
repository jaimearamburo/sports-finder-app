import "server-only";
import { del, head } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { withPermission } from "@/lib/auth-guards";
import { canManageVenue } from "@/lib/authz/policies";
import { isListingImageType, isUploadPathnameForVenue, isVenueImageUrl } from "@/lib/listing-images";

const VENUE_NOT_FOUND = "This venue doesn't exist, or it isn't one you manage.";

export type UploadPermissionResult = { ok: true } | { ok: false; error: string };

// Whether this user may upload a listing photo to `pathname` for this venue:
// the same check as managing the venue's listings, and only into that venue's
// folder. The upload route issues a one-time permission only on success; the
// Blob token never reaches the browser.
//
// Checked by venue, not listing, because a new listing's photo is uploaded
// before the listing exists.
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

// Checks a photo URL before a listing stores it (the caller has already checked
// the venue): it must be in that venue's folder in our store, and the file must
// exist with an allowed type. Returns a form error, or null.
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

// Deletes a photo that a save replaced or removed. Best effort, after saving,
// so a failure leaves an unused file rather than a broken listing. Kept if
// another listing still uses it.
export async function deleteReplacedListingImage(url: string): Promise<void> {
  try {
    const stillUsed = await prisma.listing.count({ where: { imageUrl: url } });
    if (stillUsed === 0) await del(url);
  } catch (error) {
    console.error("Couldn't delete a replaced listing image", error);
  }
}
