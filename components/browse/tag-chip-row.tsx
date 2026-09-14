"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TagChipGroup } from "@/components/browse/tag-chip-group";

// Owns the URL/routing logic only - reads the current selection from
// searchParams and decides what the URL should become. All rendering,
// optimistic display, and pending state lives in TagChipGroup.
export function TagChipRow({ tags }: { tags: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selected = new Set((searchParams.get("tags") ?? "").split(",").filter(Boolean));

  function changeAction(next: Set<string>) {
    // Cloned from the current params so category/price/city stay put —
    // this only ever rewrites its own `tags` key.
    const params = new URLSearchParams(searchParams.toString());
    if (next.size > 0) {
      params.set("tags", Array.from(next).join(","));
    } else {
      params.delete("tags");
    }
    // push, not replace — each tag toggle is its own browser-history
    // entry, so the back button steps back through filter states.
    router.push(`${pathname}?${params.toString()}`);
  }

  return <TagChipGroup tags={tags} selected={selected} changeAction={changeAction} />;
}
