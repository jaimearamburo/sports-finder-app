import type { UserRole } from "@/generated/prisma/enums";
import { can } from "@/lib/authz/permissions";

export type AccountLink = { label: string; href: string };

// The account links the header shows a signed-in user, decided by
// permission rather than by naming roles (see lib/authz/permissions.ts).
// Anyone who can open the venue dashboard gets it first, plus My Bookings:
// venue managers and admins can book like anyone else. Everyone else gets
// their account area, whose side nav holds My Bookings.
//
// Takes a plain role rather than the session so the mobile UserMenu
// (a Client Component) can call it with the one value it's given.
export function getAccountLinks(role: UserRole): AccountLink[] {
  if (can({ role }, "dashboard:access")) {
    return [
      { label: "Dashboard", href: "/dashboard" },
      { label: "My Bookings", href: "/account" },
    ];
  }
  return [{ label: "My Account", href: "/account" }];
}
