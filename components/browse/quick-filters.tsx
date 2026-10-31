"use client";

import { useBrowseFilters } from "@/contexts/browse-navigation";
import { PRICE_MIN, PRICE_MAX } from "@/lib/price-range";
import { browsePriceSchema } from "@/lib/validation/browse";
import { QuickFiltersPanel, type QuickFilterValues } from "@/components/browse/quick-filters-panel";

// Owns the date, priceMin and priceMax URL params (set or delete); rendering
// lives in QuickFiltersPanel. The sidebar's price slider writes the same price
// params. Goes through useBrowseFilters, so a change still loading from another
// control is kept.
export function QuickFilters() {
  const { params, update } = useBrowseFilters();

  const date = params.get("date") ?? "";
  // browsePriceSchema, so junk values mean no price filter rather than NaN.
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
