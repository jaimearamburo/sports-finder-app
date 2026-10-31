"use client";

import { useLayoutEffect } from "react";

// Time of the last back/forward navigation, set at module level so it's
// recorded before the new page's effects run.
let lastHistoryNavigationAt = 0;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    lastHistoryNavigationAt = Date.now();
  });
}

// Opens the listing page at the top when reached through a link. Next.js only
// scrolls to top when the new page's top isn't already in view, so after a
// deeply scrolled browse page the old position could carry over and open the
// listing near the bottom (seen in desktop Chrome).
//
// Back/forward navigation is left alone so the browser can restore the
// position. Runs before paint (useLayoutEffect).
export function ScrollToTopOnOpen() {
  useLayoutEffect(() => {
    if (Date.now() - lastHistoryNavigationAt < 1000) return;
    window.scrollTo(0, 0);
  }, []);
  return null;
}
