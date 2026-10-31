import Link from "next/link";
import { cn } from "@/lib/utils";

/** The "PlayBook" logo, shared by SiteHeader (md) and SiteFooter (sm). */
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
      {/* Oleo Script only has weights 400/700, so "Play" is lighter by colour.
          The compact "PB" form is header-only (size="md") on narrow phones, to
          make room for the search box. */}
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
