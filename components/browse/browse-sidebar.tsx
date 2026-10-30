"use client";

import { useBrowseFilters } from "@/contexts/browse-navigation";
import { BrowseSidebarPanel, type SidebarFilterValues } from "@/components/browse/browse-sidebar-panel";
import { PRICE_MIN, PRICE_MAX } from "@/lib/price-range";
import { browsePriceSchema } from "@/lib/validation/browse";
import type { BrowseCityGroup } from "@/lib/browse-cities";

// Shared by BrowseSidebar (the desktop vertical column) and MobileFilterBar
// (the mobile horizontal pill row) - both filter the exact same URL params
// (category/city/priceMin/priceMax), just through two different-shaped UIs
// shown at different breakpoints via plain CSS, (see BrowsePageShell). 
// One shared definition of how a selection becomes a URL change means one source of truth,
// so the two can't quietly drift apart the way two independently maintained copies could.
// Reads and writes through useBrowseFilters, so the values shown include a
// change that's still loading - from this control or any other.
export function useSidebarFilterRouting(): SidebarFilterValues & {
  changeAction: (next: SidebarFilterValues) => void;
} {
  const { params, update } = useBrowseFilters();

  const category = params.get("category") ?? "all";
  const city = params.get("city") ?? "";
  // Parsed, not just Number()'d - see browsePriceSchema for the render loop
  // a non-numeric value used to cause. `?? undefined`, not `?? null`: a
  // missing param must fall back to the default, and coercing null would
  // read as 0.
  const { priceMin, priceMax } = browsePriceSchema.parse({
    priceMin: params.get("priceMin") ?? undefined,
    priceMax: params.get("priceMax") ?? undefined,
  });

  function changeAction(next: SidebarFilterValues) {
    // Only these four keys change, so tags and everything else stay put.
    // Each filter is removed entirely rather than written as its default
    // value, keeping the URL clean when nothing is filtered.
    update((params) => {
      if (next.category === "all") {
        params.delete("category");
      } else {
        params.set("category", next.category);
      }

      if (next.city === "") {
        params.delete("city");
      } else {
        params.set("city", next.city);
      }

      if (next.priceMin <= PRICE_MIN) {
        params.delete("priceMin");
      } else {
        params.set("priceMin", String(next.priceMin));
      }

      if (next.priceMax >= PRICE_MAX) {
        params.delete("priceMax");
      } else {
        params.set("priceMax", String(next.priceMax));
      }
    });
  }

  return { category, city, priceMin, priceMax, changeAction };
}

// Owns the URL and routing logic only, via useSidebarFilterRouting above.
// All rendering lives in BrowseSidebarPanel.
export function BrowseSidebar({ cities }: { cities: BrowseCityGroup[] }) {
  const { category, city, priceMin, priceMax, changeAction } = useSidebarFilterRouting();

  return (
    <BrowseSidebarPanel
      cities={cities}
      category={category}
      city={city}
      priceMin={priceMin}
      priceMax={priceMax}
      changeAction={changeAction}
    />
  );
}
