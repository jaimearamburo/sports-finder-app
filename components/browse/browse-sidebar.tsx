"use client";

import { useBrowseFilters } from "@/contexts/browse-navigation";
import { BrowseSidebarPanel, type SidebarFilterValues } from "@/components/browse/browse-sidebar-panel";
import { PRICE_MIN, PRICE_MAX } from "@/lib/price-range";
import { browsePriceSchema } from "@/lib/validation/browse";
import type { BrowseCityGroup } from "@/lib/browse-cities";

// Shared by BrowseSidebar (desktop column) and MobileFilterBar (phone pill
// row), which filter the same URL params (category, city, priceMin, priceMax),
// so both turn selections into URLs the same way. Values come from
// useBrowseFilters, so they include a change still loading from any control.
export function useSidebarFilterRouting(): SidebarFilterValues & {
  changeAction: (next: SidebarFilterValues) => void;
} {
  const { params, update } = useBrowseFilters();

  const category = params.get("category") ?? "all";
  const city = params.get("city") ?? "";
  // Parsed (browsePriceSchema) so junk values fall back to defaults. `??
  // undefined`, not null: null would coerce to 0.
  const { priceMin, priceMax } = browsePriceSchema.parse({
    priceMin: params.get("priceMin") ?? undefined,
    priceMax: params.get("priceMax") ?? undefined,
  });

  function changeAction(next: SidebarFilterValues) {
    // Only these four keys change. A filter at its default is removed from the
    // URL rather than written out.
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

// URL logic only (useSidebarFilterRouting); rendering lives in
// BrowseSidebarPanel.
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
