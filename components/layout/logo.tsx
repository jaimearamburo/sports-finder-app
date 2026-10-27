import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The "PlayBook" logo, shared between SiteHeader (larger) and
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
      {/* Oleo Script only has weights 400/700, so "Play" reads lighter
          through color rather than a lighter weight the typeface doesn't
          have. The compact "PB" form only applies at size="md" (the
          header): it frees up space for the search input on a narrow
          phone. SiteFooter's size="sm" always shows the full wordmark,
          since it isn't competing with a search bar for width. */}
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
