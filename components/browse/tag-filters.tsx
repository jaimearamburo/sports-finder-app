"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TagFilterChips } from "@/components/browse/tag-filter-chips";

// Owns the URL and routing logic only. Reads the current selection from
// searchParams and decides what the URL should become. All rendering,
// optimistic display, and pending state lives in TagFilterChips.
export function TagFilters({
  tags,
}: {
  tags: { id: string; name: string; emoji: string; color: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selected = new Set((searchParams.get("tags") ?? "").split(",").filter(Boolean));

  function changeAction(next: Set<string>) {
    // Cloned from the current params so category, price, and city stay
    // put. This only ever rewrites the tags key.
    const params = new URLSearchParams(searchParams.toString());
    if (next.size > 0) {
      params.set("tags", Array.from(next).join(","));
    } else {
      params.delete("tags");
    }
    // push, not replace, so each tag toggle is its own browser history
    // entry and the back button steps back through filter states.
    router.push(`${pathname}?${params.toString()}`);
  }

  return <TagFilterChips tags={tags} selected={selected} changeAction={changeAction} />;
}
