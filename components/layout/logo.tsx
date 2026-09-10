import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The "PlayBook" logo — shared between SiteHeader (larger) and
 * SiteFooter (smaller).
 */
export function Logo({ size = "md", className }: { size?: "sm" | "md"; className?: string }) {
  return (
    <Link
      href="/"
      className={cn("font-display leading-none whitespace-nowrap", size === "md" ? "text-3xl" : "text-xl", className)}
    >
      {/* Oleo Script only has weights 400/700 — "Play" reads lighter
          through color rather than a lighter weight that doesn't exist in
          this typeface. */}
      <span className="font-normal text-amber-500">Play</span>
      <span className="font-bold text-foreground">Book</span>
    </Link>
  );
}
