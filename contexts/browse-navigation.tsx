"use client";

import { createContext, startTransition, use, useMemo, useOptimistic, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Where the browse page is navigating to, shared by every filter control
// (sidebar, mobile bar, quick-filter pills, tag chips, search chips, header
// search).
//
// The URL holds the filters but only changes when a navigation finishes. Every
// control builds its next URL on the one already in flight, so quick clicks
// across controls add up instead of replacing each other. Also provides one
// loading flag that dims the results, including while the header search
// interprets a query.
//
// One optimistic value (useOptimistic), no state library: shown immediately,
// dropped once the navigation lands and the real URL says the same. Callers use
// only the hooks. In contexts/ because the site header uses it too.
//
// Every consumer re-renders on each filter change, which is cheap at this size;
// splitting values and actions into two contexts would avoid it if needed.
type BrowseNavigationValue = {
  // The query string being navigated to, or null when nothing is in flight.
  pendingQuery: string | null;
  isPending: boolean;
  // Shows a browse URL as current straight away and navigates to it. Must
  // be called inside a transition (useOptimistic requires it).
  pushBrowse: (query: string) => void;
  // Marks the page as loading for work that hasn't produced a URL yet (the
  // header search waiting on its interpretation). Inside a transition too.
  markPending: () => void;
};

const BrowseNavigationContext = createContext<BrowseNavigationValue | null>(null);

// In the root layout, above the header and the page, since the header search
// uses it. Doesn't read useSearchParams (that would make every page wait for
// the URL on the client); the hooks do.
export function BrowseNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pendingQuery, setPendingQuery] = useOptimistic<string | null>(null);
  const [isPending, setIsPending] = useOptimistic(false);

  const value = useMemo<BrowseNavigationValue>(
    () => ({
      pendingQuery,
      isPending,
      pushBrowse(query) {
        setPendingQuery(query);
        setIsPending(true);
        // push, not replace, so the back button steps through filter states.
        // Always "/": browse is the home page.
        router.push(query ? `/?${query}` : "/");
      },
      markPending() {
        setIsPending(true);
      },
    }),
    [pendingQuery, isPending, router, setPendingQuery, setIsPending]
  );

  return <BrowseNavigationContext value={value}>{children}</BrowseNavigationContext>;
}

export function useBrowseNavigation(): BrowseNavigationValue {
  const value = use(BrowseNavigationContext);
  if (!value) throw new Error("useBrowseNavigation must be used inside BrowseNavigationProvider");
  return value;
}

// The filters to display and build on: the URL in flight if any, else the URL
// on screen. update() applies a change on top of it.
export function useBrowseFilters(): {
  params: URLSearchParams;
  isPending: boolean;
  update: (change: (params: URLSearchParams) => void) => void;
} {
  const searchParams = useSearchParams();
  const { pendingQuery, isPending, pushBrowse } = useBrowseNavigation();
  const current = pendingQuery ?? searchParams.toString();
  const params = useMemo(() => new URLSearchParams(current), [current]);

  function update(change: (params: URLSearchParams) => void) {
    const next = new URLSearchParams(current);
    change(next);
    startTransition(() => pushBrowse(next.toString()));
  }

  return { params, isPending, update };
}
