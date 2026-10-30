import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// The two-column layout for an area with its own section nav: the account
// area and the venue dashboard. Mirrors BrowsePageShell's responsive
// pattern (aside + content, collapsing to one column below `md`): on
// desktop the nav is a sidebar, on phones the same links become a pill row
// above the content. The swap is plain CSS breakpoints, not a JS viewport
// check, so there's no "wrong layout first" flash after load.
//
// `wide` gives table-heavy areas (the dashboard) more room than the
// account area needs.
export function SectionPageShell({
  sidebar,
  mobileNav,
  wide = false,
  children,
}: {
  sidebar: ReactNode;
  mobileNav: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto grid w-full grid-cols-1 gap-8 px-4 py-7 sm:px-6 md:grid-cols-[180px_minmax(0,1fr)]",
        wide ? "max-w-7xl" : "max-w-5xl"
      )}
    >
      <aside className="hidden self-start md:block">{sidebar}</aside>
      {/* A div, not <main> - see BrowsePageShell; the root layout owns the
          one <main> landmark. */}
      <div className="min-w-0">
        <div className="md:hidden">{mobileNav}</div>
        {children}
      </div>
    </div>
  );
}
