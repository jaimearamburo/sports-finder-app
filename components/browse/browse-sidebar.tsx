"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BrowseSidebarPanel, type SidebarFilterValues } from "@/components/browse/browse-sidebar-panel";
import { PRICE_MIN, PRICE_MAX } from "@/lib/price-range";

// Owns the URL and routing logic only. Reads every sidebar filter from
// searchParams and decides what the URL should become. All rendering,
// optimistic display, and pending state lives in BrowseSidebarPanel.
export function BrowseSidebar({ cities }: { cities: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const category = searchParams.get("category") ?? "all";
  const city = searchParams.get("city") ?? "";
  const types = new Set((searchParams.get("type") ?? "").split(",").filter(Boolean));
  const priceMin = Number(searchParams.get("priceMin") ?? PRICE_MIN);
  const priceMax = Number(searchParams.get("priceMax") ?? PRICE_MAX);

  function changeAction(next: SidebarFilterValues) {
    // Cloned from the current params so tags stay put. Each filter maps
    // to its own key and is removed entirely rather than written as its
    // default value, keeping the URL clean when nothing is filtered.
    const params = new URLSearchParams(searchParams.toString());

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

    if (next.types.size === 0) {
      params.delete("type");
    } else {
      params.set("type", Array.from(next.types).join(","));
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

    // push, not replace, so each filter change is its own browser history
    // entry and the back button steps back through filter states.
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <BrowseSidebarPanel
      cities={cities}
      category={category}
      city={city}
      types={types}
      priceMin={priceMin}
      priceMax={priceMax}
      changeAction={changeAction}
    />
  );
}
