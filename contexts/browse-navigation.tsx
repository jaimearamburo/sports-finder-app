"use client";

import { createContext, startTransition, use, useMemo, useOptimistic, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// One shared record of where the browse page is navigating to, for every
// control that changes its filters: the sidebar, the mobile filter bar, the
// quick-filter pills, the tag chips, the search chips and the header search.
//
// Why it exists: the URL is the source of truth for the filters, but it only
// changes once a navigation finishes. When each control built its next URL
// from the URL on screen, a quick second click in a different control
// (Free, then Tennis) was built from the old URL and replaced the first
// navigation, losing the first filter. Here, every control builds on the
// URL that's already on its way, so quick clicks across controls add up.
//
// It also gives the page one "something is loading" flag, which is what
// dims the results - including while the header search, which sits outside
// the browse page, interprets a query.
//
// No state library: this is one optimistic value. useOptimistic shows it
// immediately and drops it once the navigation lands, after which the real
// URL (which then says the same thing) takes over.
//
// Packaged as one module - context, provider and hooks together - so callers
// only ever use the hooks and never touch the context object directly. It
// lives in contexts/ rather than components/browse/ because it isn't a
// visual component and the site header uses it too.
//
// If re-renders ever matter (every consumer re-renders on each filter
// click today, which is cheap at this size), the next step would be splitting
// this into a values context and an actions context, so components that
// only call actions stop re-rendering.
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

// Lives in the root layout, above both the site header and the page, because
// the header search takes part too. Deliberately doesn't read
// useSearchParams itself: that would make every page in the app wait for the
// URL on the client. The hooks below read it, in components that already do.
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
        // push, not replace, so each filter change is its own history entry
        // and the back button steps back through filter states. Always "/":
        // browse is the home page, and the header search navigates there
        // from any page.
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

// The browse filters every control should display and build on: the URL
// currently being navigated to if there is one, otherwise the URL on screen.
// update() applies a change on top of exactly that, so a second click never
// discards a first one that's still loading.
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
