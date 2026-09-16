"use server";

import { updateTag } from "next/cache";

export type DevRevalidateBrowseState = { success?: boolean } | undefined;

/**
 * TEMPORARY DEV-ONLY TOOL — deletable once an admin UI exists to manage
 * tags/venues, which would revalidate these on save instead.
 *
 * getBrowseTags and getBrowseCities cache their query results for an hour
 * (see lib/browse-tags.ts, lib/browse-cities.ts). Reseeding the database
 * changes the underlying rows but not that cache, so without this the
 * browse page keeps showing pre-reseed tags/cities until the cache expires
 * on its own. The `NODE_ENV` check is defense in depth, same as
 * dev/reset-password/actions.ts - there is nothing sensitive here, but a
 * production route that force-clears a cache on demand isn't something to
 * leave reachable regardless.
 */
export async function devRevalidateBrowse(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState always calls with (state, payload); this action needs neither.
  _prevState: DevRevalidateBrowseState
): Promise<DevRevalidateBrowseState> {
  if (process.env.NODE_ENV === "production") {
    return { success: false };
  }

  updateTag("browse-tags");
  updateTag("browse-cities");

  return { success: true };
}
