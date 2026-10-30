"use client";

import type { ReactNode } from "react";
import { useBrowseNavigation } from "@/contexts/browse-navigation";

// Dims and slightly blurs the results while anything is loading new ones:
// a filter change from any control, or a header search still being
// interpreted. The existing results stay visible underneath (there's no key
// on the Suspense inside, so a transition keeps them), which reads as
// "updating" rather than a blank page.
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
