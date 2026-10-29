"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

// Browser back/forward never re-fetches: Next.js restores the page from its
// in-memory history cache (by design - see the staleTimes docs, which can't
// change this), so a listing page came back exactly as it was before a hold
// started, without the active-hold banner, and with stale availability.
// This re-fetches the restored page from the server whenever a back/forward
// navigation lands on a listing or checkout page, the pages whose server
// render depends on hold state. Scoped rather than global: refreshing every
// page on back would re-run the heavy browse query for nothing.
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
