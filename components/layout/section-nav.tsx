"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Section nav for the account area and the dashboard: a sidebar on desktop and
// a pill row on phones (SectionPageShell shows one or the other). Each area
// passes its own links.
export type SectionNavLink = {
  label: string;
  href: string;
  // Highlight only on this exact path (an area's home would otherwise match
  // every page under it).
  exact?: boolean;
};

function isActive(pathname: string, link: SectionNavLink): boolean {
  if (link.exact) return pathname === link.href;
  return pathname === link.href || pathname.startsWith(`${link.href}/`);
}

export function SectionSidebarNav({ label, links }: { label: string; links: SectionNavLink[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="flex flex-col gap-1">
      {links.map((link) => {
        const active = isActive(pathname, link);
        return (
          // Same selected style as the browse sidebar: blue left edge on a
          // light tint.
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

// The same links as a pill row, like browse's MobileFilterBar.
export function SectionMobileNav({ label, links }: { label: string; links: SectionNavLink[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="mb-3 flex gap-1.5 overflow-x-auto">
      {links.map((link) => {
        const active = isActive(pathname, link);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
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
    </nav>
  );
}
