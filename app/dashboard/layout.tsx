import type { ReactNode } from "react";
import { SectionPageShell } from "@/components/layout/section-page-shell";
import { SectionMobileNav, SectionSidebarNav, type SectionNavLink } from "@/components/layout/section-nav";
import { requirePermission } from "@/lib/auth-guards";

const DASHBOARD_LINKS: SectionNavLink[] = [
  { label: "Overview", href: "/dashboard", exact: true },
  { label: "Venues", href: "/dashboard/venues" },
  { label: "Bookings", href: "/dashboard/bookings" },
];

// The venue dashboard's chrome: the section nav as a sidebar on desktop and
// a pill row on phones, around every dashboard page.
//
// requirePermission here is about what's shown, not the protection. Without
// it, a page's not-found for someone without access would render inside
// this layout, showing them the dashboard's own navigation. The protection
// stays in each page (layouts don't re-render on client-side navigation,
// so a layout check can be skipped) and in the data functions.
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
