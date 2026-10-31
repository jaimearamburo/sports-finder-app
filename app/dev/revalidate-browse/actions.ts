"use server";

import { updateTag } from "next/cache";

export type DevRevalidateBrowseState = { success?: boolean } | undefined;

/**
 * Development-only tool, to be deleted once an admin UI revalidates tags and
 * venues on save.
 *
 * Browse tags and cities are cached for an hour, so after a reseed the browse
 * page shows old data until this clears the cache. The NODE_ENV check keeps it
 * off deployed builds.
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
