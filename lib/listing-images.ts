// Listing photo rules, shared by the upload route, the listing form, the save
// path and next.config.ts. Not server-only: the form rejects bad files before
// uploading, and the server re-checks.
//
// The browser uploads straight to Vercel Blob (no Server Action or function
// size limits) after getting a one-time permission from
// app/api/dashboard/listing-images, issued only after the dashboard ownership
// check and only for that venue's folder. The listing stores the URL when the
// form is saved.

// The public Blob store's hostname (not a secret). Defaults to production's
// store; development sets BLOB_STORE_HOST to its own store, so dev never
// touches production photos.
export const LISTING_IMAGE_HOST = process.env.BLOB_STORE_HOST || "gyxokpanddvb8lgw.public.blob.vercel-storage.com";
export const LISTING_IMAGE_FOLDER = "listings";

// JPEG, PNG and WebP only. No SVG (can carry scripts) or GIF.
export const LISTING_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export type ListingImageType = keyof typeof LISTING_IMAGE_TYPES;

// About 4 MB; next/image serves resized copies to visitors.
export const LISTING_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

// Uploads start right after the permission is issued, so a few minutes is
// enough.
export const UPLOAD_PERMISSION_MINUTES = 5;

export const LISTING_IMAGE_URL_MAX_LENGTH = 500;

export function isListingImageType(type: string): type is ListingImageType {
  return Object.hasOwn(LISTING_IMAGE_TYPES, type);
}

// A form message for an unacceptable file, or null. The upload permission
// enforces the same limits.
export function listingImageFileError(file: { type: string; size: number }): string | null {
  if (!isListingImageType(file.type)) return "Choose a JPEG, PNG or WebP photo.";
  if (file.size > LISTING_IMAGE_MAX_BYTES) return "That photo is over 4 MB. Choose a smaller one.";
  return null;
}

// One folder per venue, so upload permissions and saved URLs can be checked
// against their venue. Blob adds a random suffix, so names never clash and URLs
// can't be guessed.
export function venueImageFolder(venueId: string): string {
  return `${LISTING_IMAGE_FOLDER}/${venueId}/`;
}

export function listingImagePathname(venueId: string, type: ListingImageType): string {
  return `${venueImageFolder(venueId)}photo.${LISTING_IMAGE_TYPES[type]}`;
}

// Only the exact pathname listingImagePathname produces for this venue.
export function isUploadPathnameForVenue(pathname: string, venueId: string): boolean {
  return Object.keys(LISTING_IMAGE_TYPES).some(
    (type) => pathname === listingImagePathname(venueId, type as ListingImageType)
  );
}

// Whether a URL is a photo uploaded for this venue in our store. Stops a
// crafted save pointing a listing at any web image or another venue's photo.
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
    // One file directly in the folder; URL parsing has already resolved any
    // "..".
    fileName.length > 0 &&
    !fileName.includes("/")
  );
}
