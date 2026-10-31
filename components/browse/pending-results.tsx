"use client";

import type { ReactNode } from "react";
import { useBrowseNavigation } from "@/contexts/browse-navigation";

// Dims and blurs the results while new ones load (a filter change or a header
// search). The old results stay visible underneath (the Suspense inside has no
// key, so a transition keeps them).
export function PendingResults({ children }: { children: ReactNode }) {
  const { isPending } = useBrowseNavigation();
  return (
    <div
      aria-busy={isPending}
      className={`transition-[filter,opacity] duration-200 ${isPending ? "opacity-30 blur-[1px]" : ""}`}
    >
      {children}
    </div>
  );
}
