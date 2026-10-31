"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const INTERVAL_MS = 2000;

// Re-renders the page every couple of seconds while a payment settles, so the
// confirmation page picks up the webhook's result. Stops once the page renders
// without it.
export function RefreshWhilePending() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), INTERVAL_MS);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
