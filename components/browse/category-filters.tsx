"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CategoryFilterList } from "@/components/browse/category-filter-list";

// Owns the URL and routing logic only. Reads the current category from
// searchParams and decides what the URL should become. All rendering,
// optimistic display, and pending state lives in CategoryFilterList.
export function CategoryFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeId = searchParams.get("category") ?? "all";

  function changeAction(id: string) {
    // Cloned from the current params so tags, price, and city stay put.
    // This only ever rewrites the category key.
    const params = new URLSearchParams(searchParams.toString());
    if (id === "all") {
      params.delete("category");
    } else {
      params.set("category", id);
    }
    // push, not replace, so each category change is its own browser
    // history entry and the back button steps back through filter states.
    router.push(`${pathname}?${params.toString()}`);
  }

  return <CategoryFilterList activeId={activeId} changeAction={changeAction} />;
}
