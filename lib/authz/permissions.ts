import type { UserRole } from "@/generated/prisma/enums";

// The single map of what each role may do. Code asks can(user, permission),
// never "is this user an admin?", so changing a role's rights is an edit here
// alone. Roles live on User.role; their permissions live in code.
//
// Record-level questions ("does this owner own this venue?") are in
// policies.ts. No server-only imports, so it runs in the proxy, server and
// client components, and tests.

export const PERMISSIONS = [
  // Open the venue manager dashboard.
  "dashboard:access",
  // Create a new venue.
  "venues:create",
  // Manage venues the user owns, and their listings and bookings.
  "venues:manage",
  // Every venue regardless of owner; lets admins pass policies.ts's ownership
  // checks without naming a role.
  "venues:manage-all",
  // Choose a venue's owner. Without it, whoever adds a venue owns it.
  "venues:assign-owner",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

// A Record over every role, so a new database role is a compile error until
// it's given permissions.
const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  user: [],
  venue_owner: ["dashboard:access", "venues:create", "venues:manage"],
  admin: ["dashboard:access", "venues:create", "venues:manage", "venues:manage-all", "venues:assign-owner"],
};

// The minimum shape needed, so a session user, database row or test fixture all
// work.
export type RoleHolder = { role: UserRole };

// null/undefined (signed out) is never allowed anything.
export function can(user: RoleHolder | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role].includes(permission);
}
