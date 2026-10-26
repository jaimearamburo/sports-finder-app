import type { UserRole } from "@/generated/prisma/enums";

// Regular users get a distinct "My Account" area - still just a
// placeholder page for now (the side-nav/My Bookings scaffold is its own
// later ticket). venue_owner and admin keep the existing "Dashboard"
// link unchanged, since neither has anything to do in the new area yet.
export function getAccountLinkInfo(role: UserRole): { label: string; href: string } {
  if (role === "user") {
    return { label: "My Account", href: "/account" };
  }
  return { label: "Dashboard", href: "/dashboard" };
}
