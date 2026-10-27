import type { ReactNode } from "react";
import { AccountPageShell } from "@/components/account/account-page-shell";
import { AccountSidebar } from "@/components/account/account-sidebar";
import { AccountMobileNav } from "@/components/account/account-mobile-nav";

// The account area's shared chrome (sidebar/mobile-nav shell) - every
// route under /account gets this, same role a top-level layout.tsx plays
// for the rest of the app via app/layout.tsx's header/footer.
export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <AccountPageShell sidebar={<AccountSidebar />}>
      <div className="md:hidden">
        <AccountMobileNav />
      </div>
      {children}
    </AccountPageShell>
  );
}
