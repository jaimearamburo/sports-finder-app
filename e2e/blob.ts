import { del, head, list } from "@vercel/blob";

// Vercel Blob access for the end-to-end tests: checking whether a listing
// photo exists, and removing the ones a run uploaded. Uses the same
// BLOB_READ_WRITE_TOKEN as the app (from .env). There's one store for the
// whole project, so cleanup is strictly limited to the test venues' own
// folders (listings/<e2e venue id>/), never the store as a whole.

export async function blobExists(url: string): Promise<boolean> {
  try {
    await head(url);
    return true;
  } catch {
    return false;
  }
}

// Deletes every photo in the given test venues' folders. Each venue id is
// checked to be a test one ("e2e-" prefix, see fixtures.ts) first, so a
// mistake here can't reach a real venue's photos.
export async function removeVenueImages(venueIds: string[]): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  for (const venueId of venueIds) {
    if (!venueId.startsWith("e2e-")) throw new Error(`Refusing to remove images for a non-test venue: ${venueId}`);
    const { blobs } = await list({ prefix: `listings/${venueId}/` });
    if (blobs.length > 0) await del(blobs.map((blob) => blob.url));
  }
}
