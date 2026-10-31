"use client";

import { useBrowseFilters } from "@/contexts/browse-navigation";
import { TagFilterChips } from "@/components/browse/tag-filter-chips";

// URL logic only: reads the selection through useBrowseFilters and decides the
// next URL. Rendering lives in TagFilterChips.
export function TagFilters({
  tags,
}: {
  tags: { id: string; name: string; emoji: string; color: string }[];
}) {
  const { params, update } = useBrowseFilters();
  const selected = new Set((params.get("tags") ?? "").split(",").filter(Boolean));

  function changeAction(next: Set<string>) {
    // Only the tags key changes.
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
