"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PRICE_MIN, PRICE_MAX } from "@/lib/price-range";
import { QuickFiltersPanel, type QuickFilterValues } from "@/components/browse/quick-filters-panel";

// Owns the "date", "priceMin", and "priceMax" URL params directly
// (clone/set-or-delete/push) and nothing else, the same router-only role
// TagFilters plays for TagFilterChips and BrowseSidebar plays for
// BrowseSidebarPanel. Exposes one changeAction callback; rendering,
// optimistic display, and pending state all live in QuickFiltersPanel.
// priceMin/priceMax are the same params BrowseSidebar's own price slider
// reads and writes - both read and write the same URL keys independently,
// since the URL itself is the single shared source of truth.
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
