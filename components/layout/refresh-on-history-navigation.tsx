"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

// Back/forward restores pages from Next's in-memory cache without re-fetching
// (staleTimes can't change this), so a listing page could show stale
// availability and no active-hold banner. This refreshes the restored page when
// a back/forward navigation lands on a listing or checkout page, whose render
// depends on hold state. Scoped so browse's heavy query isn't re-run.
export function RefreshOnHistoryNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  // The page being left at the moment popstate fires; compared against the
  // new URL so a same-page hash change (e.g. the skip link) is ignored.
  const lastPathname = useRef(pathname);
  useEffect(() => {
    lastPathname.current = pathname;
  }, [pathname]);

  useEffect(() => {
    function handlePopState() {
      const next = window.location.pathname;
      if (next === lastPathname.current || !next.startsWith("/listings/")) return;
      // Deferred one tick so Next finishes restoring the cached page first;
      // refreshing in the same tick can refresh the route being left instead.
      setTimeout(() => router.refresh(), 0);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [router]);

  return null;
}
