import type { UserRole } from "@/generated/prisma/enums";
import { can } from "@/lib/authz/permissions";

export type AccountLink = { label: string; href: string };

// The account links the header shows a signed-in user, decided by
// permission rather than by naming roles (see lib/authz/permissions.ts).
// Anyone who can open the venue dashboard gets it first, plus My Bookings:
// venue managers and admins can book like anyone else. Everyone else gets
// their account area, whose side nav holds My Bookings.
//
// Takes a plain role rather than the session so AccountMenu (a Client
// Component) can call it with the plain values it's given.
export function getAccountLinks(role: UserRole): AccountLink[] {
  if (can({ role }, "dashboard:access")) {
    return [
      { label: "Dashboard", href: "/dashboard" },
      { label: "My Bookings", href: "/account" },
    ];
  }
  return [{ label: "My Account", href: "/account" }];
}

// The badge shown next to a signed-in user's name, so it's always clear
// which kind of account is in use. Regular users get none: it's the
// default, and a badge on every customer's header would be noise.
const ROLE_BADGES: Record<UserRole, string | null> = {
  user: null,
  venue_owner: "Venue owner",
  admin: "Admin",
};

export function getRoleBadge(role: UserRole): string | null {
  return ROLE_BADGES[role];
}

// Up to two initials for the avatar: "Emma Collins" -> "EC", "Jamie" ->
// "J". Falls back to the email's first letter for accounts with no name.
export function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length > 0) return words.slice(0, 2).map((word) => word[0].toUpperCase()).join("");
  return (email ?? "?").charAt(0).toUpperCase();
}
