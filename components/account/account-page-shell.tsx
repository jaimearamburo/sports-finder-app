import type { ReactNode } from "react";

// Mirrors BrowsePageShell's responsive pattern (aside + main, collapsing
// to one column below `md`) rather than inventing a new one - the account
// area's own sidebar (today: just "My Bookings," role-based sections like
// "My Venues" later) plays the same role browse's filter sidebar does.
// The caller renders the mobile equivalent inside `children`, shown only
// below `md` via plain CSS, same as app/page.tsx does with
// MobileFilterBar - no JS viewport check, so there's no post-mount
// "wrong layout first" flash.
export function AccountPageShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-8 px-4 py-7 sm:px-6 md:grid-cols-[180px_minmax(0,1fr)]">
      <aside className="hidden self-start md:block">{sidebar}</aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
