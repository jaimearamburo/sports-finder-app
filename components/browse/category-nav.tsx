"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/lib/browse-filters";

export function CategoryNav() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeId = searchParams.get("category") ?? "all";

  function selectCategory(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (id === "all") {
      params.delete("category");
    } else {
      params.set("category", id);
    }
    // replace, not push - so that clicking through five categories doesn't leave
    // five stops in the browser's history.
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <nav aria-label="Browse categories" className="flex flex-col">
      {CATEGORIES.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => selectCategory(category.id)}
          aria-current={activeId === category.id ? "true" : undefined}
          className={cn(
            "border-l-2 border-transparent px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            activeId === category.id && "border-primary bg-muted/60 font-semibold text-foreground"
          )}
        >
          {category.label}
        </button>
      ))}
    </nav>
  );
}
