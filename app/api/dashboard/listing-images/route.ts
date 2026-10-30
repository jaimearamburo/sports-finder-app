import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { authorizeListingImageUpload } from "@/lib/dashboard/listing-images";
import { LISTING_IMAGE_MAX_BYTES, LISTING_IMAGE_TYPES, UPLOAD_PERMISSION_MINUTES } from "@/lib/listing-images";

// Gives the listing form a one-time permission (a short-lived client token)
// to upload one photo straight to Vercel Blob. Called by `upload()` from
// @vercel/blob/client, see components/dashboard/listing-image-field.tsx.
//
// A route handler, not a Server Action, because that's what the Blob client
// calls. It's a public endpoint like any other, so it does the same checks
// a Server Action's data function would: signed in, venues:manage, owns the
// venue, and the file name is in that venue's folder - all in
// authorizeListingImageUpload. The permission it returns only allows that
// one path, the three image types, files up to the size limit, and only
// for a few minutes; Blob itself enforces those. The store's real token
// (BLOB_READ_WRITE_TOKEN) never leaves the server.
//
// No upload-completed callback (onUploadCompleted): the listing stores the
// image URL when the form is saved, which re-checks everything. Blob only
// calls back when a callback URL is set, so that half of handleUpload is
// unused (and it verifies Blob's signature on any such request anyway).
export async function POST(request: Request): Promise<Response> {
  // The Blob client always sends JSON. Requiring it means a plain
  // cross-site form post can't reach the handler (a JSON request from
  // another site needs a CORS preflight, which this route doesn't allow).
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ error: "Expected JSON." }, { status: 415 });
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return Response.json({ error: "Expected JSON." }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let venueId: unknown;
        try {
          venueId = (JSON.parse(clientPayload ?? "null") as { venueId?: unknown } | null)?.venueId;
        } catch {
          venueId = undefined;
        }
        const allowed = await authorizeListingImageUpload(venueId, pathname);
        // handleUpload turns a throw into the error response below.
        if (!allowed.ok) throw new UploadRefused(allowed.error);
        return {
          allowedContentTypes: Object.keys(LISTING_IMAGE_TYPES),
          maximumSizeInBytes: LISTING_IMAGE_MAX_BYTES,
          addRandomSuffix: true,
          allowOverwrite: false,
          validUntil: Date.now() + UPLOAD_PERMISSION_MINUTES * 60 * 1000,
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    // Our own refusals carry a message meant for the form; anything else
    // (Blob unreachable, malformed request) gets a generic one, so internal
    // details never reach the browser.
    if (error instanceof UploadRefused) return Response.json({ error: error.message }, { status: 403 });
    console.error("Listing image upload permission failed", error);
    return Response.json({ error: "The upload couldn't be started. Try again." }, { status: 400 });
  }
}

class UploadRefused extends Error {}
