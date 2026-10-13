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
      className={cn(
        "font-display leading-none whitespace-nowrap",
        size === "md" ? "text-xl md:text-3xl" : "text-xl",
        className
      )}
    >
      {/* Oleo Script only has weights 400/700 — "Play" reads lighter
          through color rather than a lighter weight that doesn't exist in
          this typeface. Compact "PB" below `md` only at the header's own
          size ("md" - SiteFooter's "sm" always shows the full wordmark,
          it isn't fighting a search bar for width) - frees up space for
          the search input on a narrow phone, where the full wordmark plus
          the header's other controls don't all fit next to it. */}
      {size === "md" ? (
        <>
          <span className="md:hidden">
            <span className="font-normal text-blue-700">P</span>
            <span className="font-bold text-foreground">B</span>
          </span>
          <span className="hidden md:inline">
            <span className="font-normal text-blue-700">Play</span>
            <span className="font-bold text-foreground">Book</span>
          </span>
        </>
      ) : (
        <>
          <span className="font-normal text-blue-700">Play</span>
          <span className="font-bold text-foreground">Book</span>
        </>
      )}
    </Link>
  );
}
