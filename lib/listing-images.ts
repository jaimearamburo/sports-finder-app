// Rules for listing photos, shared by the upload route, the listing form
// and the save path (and next.config.ts, for the image hostname). Plain
// module, not server-only: the form uses the same limits to reject a wrong
// file before uploading anything, and the server re-checks all of them.
//
// How an upload works (GitHub #91): the browser uploads straight to Vercel
// Blob, so images never pass through a Server Action or function (both have
// request-size limits). It first asks app/api/dashboard/listing-images for
// a one-time permission, which is only given after the same ownership check
// as every other dashboard action, and only for that venue's own folder.
// The listing then stores the file's URL when the form is saved.

// This project's public Blob store. Not a secret (it's in every image URL),
// but tied to the store: a new store means changing it here.
export const LISTING_IMAGE_HOST = "gyxokpanddvb8lgw.public.blob.vercel-storage.com";
export const LISTING_IMAGE_FOLDER = "listings";

// JPEG, PNG and WebP only: what phones and cameras produce and every
// browser shows. No SVG (it can carry scripts) or GIF.
export const LISTING_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export type ListingImageType = keyof typeof LISTING_IMAGE_TYPES;

// About 4 MB: enough for a good phone photo, small enough to upload quickly
// on a phone connection. next/image serves resized copies, so the original's
// size doesn't reach people browsing.
export const LISTING_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

// How long an upload permission lasts. An upload starts straight after the
// permission is given, so a few minutes is plenty, and a leaked one is
// useless soon after.
export const UPLOAD_PERMISSION_MINUTES = 5;

export const LISTING_IMAGE_URL_MAX_LENGTH = 500;

export function isListingImageType(type: string): type is ListingImageType {
  return Object.hasOwn(LISTING_IMAGE_TYPES, type);
}

// What's wrong with a chosen file, in words for the form, or null if it's
// fine. The same limits are enforced by the upload permission itself.
export function listingImageFileError(file: { type: string; size: number }): string | null {
  if (!isListingImageType(file.type)) return "Choose a JPEG, PNG or WebP photo.";
  if (file.size > LISTING_IMAGE_MAX_BYTES) return "That photo is over 4 MB. Choose a smaller one.";
  return null;
}

// Where a venue's listing photos go: one folder per venue, so an upload
// permission (scoped to one path) and a saved URL can both be checked
// against the venue they're for. Blob adds a random suffix to the file
// name, so names never clash and URLs can't be guessed.
export function venueImageFolder(venueId: string): string {
  return `${LISTING_IMAGE_FOLDER}/${venueId}/`;
}

export function listingImagePathname(venueId: string, type: ListingImageType): string {
  return `${venueImageFolder(venueId)}photo.${LISTING_IMAGE_TYPES[type]}`;
}

// Whether `pathname` is one the browser may ask to upload to for this
// venue: exactly the name listingImagePathname gives, nothing else.
export function isUploadPathnameForVenue(pathname: string, venueId: string): boolean {
  return Object.keys(LISTING_IMAGE_TYPES).some(
    (type) => pathname === listingImagePathname(venueId, type as ListingImageType)
  );
}

// Whether a URL is a photo uploaded for this venue in our store - the check
// before a listing may store it. Without it, a crafted save could point a
// listing at any image on the web, or at another venue's photo (which a
// later replace would then delete).
export function isVenueImageUrl(url: string, venueId: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const folder = `/${venueImageFolder(venueId)}`;
  const fileName = parsed.pathname.slice(folder.length);
  return (
    parsed.protocol === "https:" &&
    parsed.hostname === LISTING_IMAGE_HOST &&
    parsed.port === "" &&
    parsed.search === "" &&
    parsed.hash === "" &&
    parsed.pathname.startsWith(folder) &&
    // One file directly in the folder: a name, and no deeper path. Any
    // ".." was already resolved by URL parsing, so it can't climb out.
    fileName.length > 0 &&
    !fileName.includes("/")
  );
}
