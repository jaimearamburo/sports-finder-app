"use client";

import { useBrowseFilters } from "@/contexts/browse-navigation";
import { PRICE_MIN, PRICE_MAX } from "@/lib/price-range";
import { browsePriceSchema } from "@/lib/validation/browse";
import { QuickFiltersPanel, type QuickFilterValues } from "@/components/browse/quick-filters-panel";

// Owns the "date", "priceMin", and "priceMax" URL params (set-or-delete)
// and nothing else, the same router-only role TagFilters plays for
// TagFilterChips and BrowseSidebar plays for BrowseSidebarPanel. Exposes
// one changeAction callback; rendering lives in QuickFiltersPanel. Reads
// and writes through useBrowseFilters, so a change still loading from any
// other control is kept, not overwritten.
// priceMin/priceMax are the same params BrowseSidebar's own price slider
// reads and writes - both read and write the same URL keys independently,
// since the URL itself is the single shared source of truth.
export function QuickFilters() {
  const { params, update } = useBrowseFilters();

  const date = params.get("date") ?? "";
  // Same parser BrowseSidebar uses (see browsePriceSchema), so a junk
  // value falls back to "no price filter" instead of becoming NaN.
  const { priceMin, priceMax } = browsePriceSchema.parse({
    priceMin: params.get("priceMin") ?? undefined,
    priceMax: params.get("priceMax") ?? undefined,
  });

  function changeAction(next: QuickFilterValues) {
    update((params) => {
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
    });
  }

  return <QuickFiltersPanel date={date} priceMin={priceMin} priceMax={priceMax} changeAction={changeAction} />;
}
