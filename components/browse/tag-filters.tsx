"use client";

import { useBrowseFilters } from "@/contexts/browse-navigation";
import { TagFilterChips } from "@/components/browse/tag-filter-chips";

// Owns the URL and routing logic only. Reads the current selection through
// useBrowseFilters (which includes a change still loading, from any
// control) and decides what the URL should become. All rendering lives in
// TagFilterChips.
export function TagFilters({
  tags,
}: {
  tags: { id: string; name: string; emoji: string; color: string }[];
}) {
  const { params, update } = useBrowseFilters();
  const selected = new Set((params.get("tags") ?? "").split(",").filter(Boolean));

  function changeAction(next: Set<string>) {
    // Only the tags key changes; category, price and city stay put.
    update((params) => {
      if (next.size > 0) {
        params.set("tags", Array.from(next).join(","));
      } else {
        params.delete("tags");
      }
    });
  }

  return <TagFilterChips tags={tags} selected={selected} changeAction={changeAction} />;
}
