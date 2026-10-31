import type { UserRole } from "@/generated/prisma/enums";
import { can } from "@/lib/authz/permissions";

export type AccountLink = { label: string; href: string };

// The header's account links, decided by permission. Anyone with dashboard
// access gets Dashboard plus My Bookings (managers book too); everyone else
// gets My Account. Takes a plain role so the client AccountMenu can call it.
export function getAccountLinks(role: UserRole): AccountLink[] {
  if (can({ role }, "dashboard:access")) {
    return [
      { label: "Dashboard", href: "/dashboard" },
      { label: "My Bookings", href: "/account" },
    ];
  }
  return [{ label: "My Account", href: "/account" }];
}

// Role badge next to the name. None for regular users, the default.
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
