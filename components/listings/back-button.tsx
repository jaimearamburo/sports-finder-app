"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

// A browser back-navigation, not a fixed link to "/" - so it returns
// to whatever exact browse URL (filters, tags, price range, all still in
// the query string) the visitor came from; className/
// children let each site keep its own visual treatment.
export function BackButton({ className, children }: { className?: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <button type="button" onClick={() => router.back()} className={className}>
      {children}
    </button>
  );
}
