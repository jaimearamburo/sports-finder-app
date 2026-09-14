"use client";

import { startTransition, useOptimistic } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/lib/browse-filters";

export function CategoryNav() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeId = searchParams.get("category") ?? "all";

  //
  const [optimisticActiveId, setOptimisticActiveId] = useOptimistic(activeId);
  const [isPending, setIsPending] = useOptimistic(false);

  function selectCategory(id: string) {
    // Cloned from the current params so tags/price/city stay put - this
    // only ever rewrites its own `category` key.
    const params = new URLSearchParams(searchParams.toString());
    if (id === "all") {
      params.delete("category");
    } else {
      params.set("category", id);
    }

    startTransition(() => {
      setOptimisticActiveId(id);
      setIsPending(true);
      // push instead of replace to keep browser history.
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <nav
      aria-label="Browse categories"
      className="flex flex-col"
      data-pending={isPending ? "" : undefined}
    >
      {CATEGORIES.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => selectCategory(category.id)}
          aria-current={optimisticActiveId === category.id ? "true" : undefined}
          className={cn(
            "border-l-2 border-transparent px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            optimisticActiveId === category.id &&
              "border-primary bg-muted/60 font-semibold text-foreground"
          )}
        >
          {category.label}
        </button>
      ))}
    </nav>
  );
}
