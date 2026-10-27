import type { UserRole } from "@/generated/prisma/enums";

// Regular users get a distinct "My Account" area - its side nav ("My
// Bookings" for now; role-based sections like "My Venues" for venue
// owners are their own later ticket) lives in app/account/layout.tsx.
// venue_owner and admin keep the existing "Dashboard" link unchanged,
// since neither has anything to do in the new area yet - /dashboard is
// still just a placeholder page.
export function getAccountLinkInfo(role: UserRole): { label: string; href: string } {
  if (role === "user") {
    return { label: "My Account", href: "/account" };
  }
  return { label: "Dashboard", href: "/dashboard" };
}
