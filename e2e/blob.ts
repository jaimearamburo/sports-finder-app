import { del, head, list, put } from "@vercel/blob";

// Vercel Blob access for the e2e tests: checking a photo exists and removing
// what a run uploaded. Uses BLOB_READ_WRITE_TOKEN from .env (the development
// store). Cleanup only touches the test venues' folders (listings/<e2e venue
// id>/).

export async function blobExists(url: string): Promise<boolean> {
  try {
    await head(url);
    return true;
  } catch {
    return false;
  }
}

// Stores a photo in a test venue's folder, as an upload would; for tests about
// showing photos.
export async function putTestImage(venueId: string, image: Buffer): Promise<string> {
  if (!venueId.startsWith("e2e-")) throw new Error(`Refusing to store an image for a non-test venue: ${venueId}`);
  const blob = await put(`listings/${venueId}/photo.png`, image, { access: "public", contentType: "image/png", addRandomSuffix: true });
  return blob.url;
}

// Deletes the photos in the given test venues' folders. Each id must have the
// "e2e-" prefix, so real venues' photos are never touched.
export async function removeVenueImages(venueIds: string[]): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  for (const venueId of venueIds) {
    if (!venueId.startsWith("e2e-")) throw new Error(`Refusing to remove images for a non-test venue: ${venueId}`);
    const { blobs } = await list({ prefix: `listings/${venueId}/` });
    if (blobs.length > 0) await del(blobs.map((blob) => blob.url));
  }
}
