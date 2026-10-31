import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Two-column layout for areas with a section nav (account, dashboard), like
// BrowsePageShell: a sidebar on desktop, a pill row above the content below md,
// swapped by breakpoint classes. `wide` gives the dashboard's tables more room.
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
      {/* A div, not <main>: the root layout owns the single <main>. */}
      <div className="min-w-0">
        <div className="md:hidden">{mobileNav}</div>
        {children}
      </div>
    </div>
  );
}
