import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { authorizeListingImageUpload } from "@/lib/dashboard/listing-images";
import { LISTING_IMAGE_MAX_BYTES, LISTING_IMAGE_TYPES, UPLOAD_PERMISSION_MINUTES } from "@/lib/listing-images";

// Issues a one-time permission (short-lived client token) to upload one listing
// photo straight to Vercel Blob; called by `upload()` from @vercel/blob/client.
//
// A public route handler (what the Blob client calls), so it runs the full
// checks in authorizeListingImageUpload: signed in, venues:manage, owns the
// venue, path in that venue's folder. The permission allows only that path, the
// three image types, the size limit and a few minutes; Blob enforces them.
// BLOB_READ_WRITE_TOKEN never leaves the server.
//
// No onUploadCompleted callback: the listing stores the URL on save, which
// re-checks everything.
export async function POST(request: Request): Promise<Response> {
  // The Blob client always sends JSON. Requiring it blocks plain cross-site
  // form posts (a cross-site JSON request needs a CORS preflight, which isn't
  // allowed).
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
    // Our refusals carry a form message; anything else gets a generic one so
    // internal details don't leak.
    if (error instanceof UploadRefused) return Response.json({ error: error.message }, { status: 403 });
    console.error("Listing image upload permission failed", error);
    return Response.json({ error: "The upload couldn't be started. Try again." }, { status: 400 });
  }
}

class UploadRefused extends Error {}
