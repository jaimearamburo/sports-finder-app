import type { ReactNode } from "react";
import { SectionPageShell } from "@/components/layout/section-page-shell";
import { SectionMobileNav, SectionSidebarNav, type SectionNavLink } from "@/components/layout/section-nav";
import { requirePermission } from "@/lib/auth-guards";

const DASHBOARD_LINKS: SectionNavLink[] = [
  { label: "Overview", href: "/dashboard", exact: true },
  { label: "Venues", href: "/dashboard/venues" },
  { label: "Bookings", href: "/dashboard/bookings" },
];

// The dashboard's section nav around every dashboard page.
//
// requirePermission here only stops a refused user's not-found rendering inside
// the dashboard nav. The protection is in each page (layouts don't re-render on
// client navigation) and in the data functions.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requirePermission("dashboard:access");
  return (
    <SectionPageShell
      wide
      sidebar={<SectionSidebarNav label="Dashboard" links={DASHBOARD_LINKS} />}
      mobileNav={<SectionMobileNav label="Dashboard" links={DASHBOARD_LINKS} />}
    >
      {children}
    </SectionPageShell>
  );
}
