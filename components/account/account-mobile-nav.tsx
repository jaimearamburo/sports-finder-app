"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// The mobile equivalent of AccountSidebar's vertical column - same links,
// laid out as a horizontal pill row instead, same visual pattern browse's
// MobileFilterBar uses for its own sidebar-on-desktop/pill-row-on-mobile
// swap (see AccountPageShell). Shown/hidden via plain CSS breakpoints in
// app/account/layout.tsx, not a JS viewport check.
const LINKS = [{ label: "My Bookings", href: "/account" }];

export function AccountMobileNav() {
  const pathname = usePathname();
  return (
    <div className="mb-3 flex gap-1.5">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex h-9 shrink-0 items-center rounded-md border px-3.5 text-sm font-medium transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-foreground/50 hover:text-foreground"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
