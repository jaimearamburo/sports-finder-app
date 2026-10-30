import type { UserRole } from "@/generated/prisma/enums";

// The single place that decides what each role is allowed to do.
//
// Code asks "can this user do X?" (can(user, "venues:create")), never "is
// this user an admin?". Changing what a role may do, or adding a role, is
// then an edit to this map alone, not a hunt through every `role === ...`
// check in the app. Roles themselves live on User.role in the database;
// the permissions they grant live here in code, where they're typed,
// reviewed and versioned - the usual split until roles need to be edited
// at runtime by customers, which this app doesn't need.
//
// What a user may do with one particular record ("does this owner own this
// venue?") is a separate question, answered in policies.ts.
//
// A plain module with no server-only imports, so it runs anywhere: the
// proxy, Server Components, client components (to decide which links to
// show) and unit tests.

export const PERMISSIONS = [
  // Open the venue manager dashboard.
  "dashboard:access",
  // Create a new venue.
  "venues:create",
  // Manage venues the user owns, and their listings and bookings.
  "venues:manage",
  // Manage every venue regardless of owner. Lets admins pass the ownership
  // checks in policies.ts without those checks naming a role.
  "venues:manage-all",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

// A Record over every role, so adding a role to the database enum is a
// compile error here until someone decides what it may do.
const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  user: [],
  venue_owner: ["dashboard:access", "venues:create", "venues:manage"],
  admin: ["dashboard:access", "venues:create", "venues:manage", "venues:manage-all"],
};

// The smallest shape these checks need, so callers can pass a session user,
// a database row or a test fixture alike.
export type RoleHolder = { role: UserRole };

// null/undefined means signed out, which is never allowed anything here.
export function can(user: RoleHolder | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role].includes(permission);
}
