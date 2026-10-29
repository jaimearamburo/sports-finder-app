"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Just one entry today ("My Bookings") - not pulled out into its own
// config/data file, since a role-based multi-section nav ("My Venues" for
// venue owners, etc.) is explicitly its own later ticket, not something to
// design around before it actually exists.
const LINKS = [{ label: "My Bookings", href: "/account" }];

export function AccountSidebar() {
  const pathname = usePathname();
  return (
    <nav aria-label="Account" className="flex flex-col gap-1">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          // Same selected style as the browse sidebar's categories
          // (BrowseSidebarPanel) - blue left edge on a light tint - so the
          // app's two sidebars read as one design.
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "border-l-2 border-transparent px-2.5 py-2 text-sm font-medium transition-colors",
              "text-muted-foreground hover:bg-foreground/3 hover:text-foreground/80",
              active && "border-primary bg-foreground/3 text-foreground/80"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
