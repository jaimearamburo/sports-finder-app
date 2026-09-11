"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { TAG_STYLES } from "@/lib/browse-filters";

export function TagChipRow({ tags }: { tags: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selected = new Set((searchParams.get("tags") ?? "").split(",").filter(Boolean));

  function toggleTag(name: string) {
    const slug = name.toLowerCase();
    const next = new Set(selected);
    if (next.has(slug)) {
      next.delete(slug);
    } else {
      next.add(slug);
    }

    // Cloned from the current params so category/price/city stay put —
    // this only ever rewrites its own `tags` key.
    const params = new URLSearchParams(searchParams.toString());
    if (next.size > 0) {
      params.set("tags", Array.from(next).join(","));
    } else {
      params.delete("tags");
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="mb-5 flex gap-5 overflow-x-auto pb-1">
      {tags.map((tag) => {
        const style = TAG_STYLES[tag.name];
        const isSelected = selected.has(tag.name.toLowerCase());

        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggleTag(tag.name)}
            aria-pressed={isSelected}
            className={cn(
              "group flex shrink-0 flex-col items-center gap-2.5 border-b-2 border-transparent pb-2.5",
              isSelected && style && `border-tag-${style.slug}`
            )} 
          >
            <span
              className={cn(
                "relative flex size-20 items-center justify-center overflow-hidden rounded-[22%] bg-muted shadow-sm transition-shadow",
                isSelected && style && `bg-tag-${style.slug} shadow-lg`
              )}
            >
              {isSelected && (
                <span className="pointer-events-none absolute inset-0 bg-linear-to-b from-white/25 via-transparent to-black/10" />
              )}
              <span className="relative inline-block text-2xl leading-none transition-transform duration-150 group-hover:scale-[1.5]">
                {style?.emoji ?? "🏷️"}
              </span>
            </span>
            <span className={cn("text-sm font-medium", isSelected ? "text-foreground" : "text-muted-foreground")}>
              {tag.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
