"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

// Browser back navigation rather than a link, so it returns to the exact browse
// URL with its filters.
export function BackButton({ className, children }: { className?: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <button type="button" onClick={() => router.back()} className={className}>
      {children}
    </button>
  );
}
