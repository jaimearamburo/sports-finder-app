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
    <nav className="flex flex-col gap-1">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
