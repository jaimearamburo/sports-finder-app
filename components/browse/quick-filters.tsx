"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PRICE_MIN, PRICE_MAX } from "@/lib/price-range";
import { QuickFiltersPanel, type QuickFilterValues } from "@/components/browse/quick-filters-panel";

// Owns the "date", "priceMin", and "priceMax" URL params directly (clone/
// set-or-delete/push) and nothing else - the same router-only role
// TagFilters plays for TagFilterChips, and BrowseSidebar plays for
// BrowseSidebarPanel. Reads the current values from searchParams and
// exposes one changeAction callback; all rendering, optimistic display,
// and pending state lives in QuickFiltersPanel. One router component
// owning several different quick filters as one value object (rather than
// a separate router per pill) matches BrowseSidebar's own shape - each
// pill here is a different kind of thing (a calendar pick vs. a price
// toggle), not interchangeable instances of the same filter the way tag
// chips are. priceMin/priceMax are the same params BrowseSidebar's own
// price slider already reads and writes - both components independently
// read/write the same URL keys, which is fine since the URL itself is the
// single shared source of truth, not local state either one owns.
export function QuickFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const date = searchParams.get("date") ?? "";
  const priceMin = searchParams.get("priceMin") ? Number(searchParams.get("priceMin")) : PRICE_MIN;
  const priceMax = searchParams.get("priceMax") ? Number(searchParams.get("priceMax")) : PRICE_MAX;

  function changeAction(next: QuickFilterValues) {
    const params = new URLSearchParams(searchParams.toString());

    if (next.date) {
      params.set("date", next.date);
    } else {
      params.delete("date");
    }

    if (next.priceMin > PRICE_MIN) {
      params.set("priceMin", String(next.priceMin));
    } else {
      params.delete("priceMin");
    }

    if (next.priceMax < PRICE_MAX) {
      params.set("priceMax", String(next.priceMax));
    } else {
      params.delete("priceMax");
    }

    router.push(`${pathname}?${params.toString()}`);
  }

  return <QuickFiltersPanel date={date} priceMin={priceMin} priceMax={priceMax} changeAction={changeAction} />;
}
