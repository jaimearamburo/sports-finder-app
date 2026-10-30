"use client";

import { useLayoutEffect } from "react";

// When the last back/forward navigation happened. Recorded at module level,
// so it's set before any page that mounts because of it runs its effects.
let lastHistoryNavigationAt = 0;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    lastHistoryNavigationAt = Date.now();
  });
}

// Opens the listing page at the top when it's reached through a link.
//
// Next.js normally does this itself, but only when the new page's top edge
// isn't already in view; otherwise it leaves the scroll position alone. In
// a real browser that check could pass right after leaving a long, deeply
// scrolled browse page, and the old position then carried over, clamped
// to the listing page's height: the further down browse had been
// scrolled, the further down the listing opened, often at the very bottom
// (the map). Seen in desktop Chrome; not reproducible in automated
// browsers, where the loading skeleton always resets the position first.
//
// Back/forward navigation is left alone, so the browser can restore where
// the visitor was on the page. Runs before paint (useLayoutEffect), so the
// wrong position is never shown.
export function ScrollToTopOnOpen() {
  useLayoutEffect(() => {
    if (Date.now() - lastHistoryNavigationAt < 1000) return;
    window.scrollTo(0, 0);
  }, []);
  return null;
}
