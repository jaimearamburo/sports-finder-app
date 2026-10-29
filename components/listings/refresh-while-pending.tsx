"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const INTERVAL_MS = 2000;

// Re-renders the current Server Component page every couple of seconds, for
// the confirmation page while a payment is still settling: the Stripe
// webhook confirms the booking in the background, and this picks that up
// without the customer having to reload. Stops by itself once the page
// renders without it (the booking is confirmed or has failed).
export function RefreshWhilePending() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), INTERVAL_MS);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
