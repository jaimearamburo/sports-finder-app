import type { ReactNode } from "react";
import { SectionPageShell } from "@/components/layout/section-page-shell";
import { SectionMobileNav, SectionSidebarNav, type SectionNavLink } from "@/components/layout/section-nav";

const ACCOUNT_LINKS: SectionNavLink[] = [{ label: "My Bookings", href: "/account" }];

// The account area's section nav (sidebar on desktop, pill row on phones)
// around every /account page.
export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <SectionPageShell
      sidebar={<SectionSidebarNav label="Account" links={ACCOUNT_LINKS} />}
      mobileNav={<SectionMobileNav label="Account" links={ACCOUNT_LINKS} />}
    >
      {children}
    </SectionPageShell>
  );
}
