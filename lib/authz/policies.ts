import { can, type RoleHolder } from "@/lib/authz/permissions";

// Record-level rules: may this user manage this venue or listing?
// permissions.ts decides whether the role may manage venues at all; a
// venue_owner may only manage venues they own. Pure functions, so the data
// layer loads the record and asks.

export type Actor = RoleHolder & { id: string };

export function canManageVenue(actor: Actor | null | undefined, venue: { ownerId: string }): boolean {
  if (!actor) return false;
  if (can(actor, "venues:manage-all")) return true;
  return can(actor, "venues:manage") && venue.ownerId === actor.id;
}

// A listing belongs to whoever may manage its venue.
export function canManageListing(
  actor: Actor | null | undefined,
  listing: { venue: { ownerId: string } }
): boolean {
  return canManageVenue(actor, listing.venue);
}

// A Prisma Venue `where` scoping lists to what the actor may manage: everything
// for an admin, their own venues for an owner. null when they may manage
// nothing, so the caller skips the query.
export function manageableVenuesWhere(actor: Actor | null | undefined): { ownerId?: string } | null {
  if (!actor) return null;
  if (can(actor, "venues:manage-all")) return {};
  if (can(actor, "venues:manage")) return { ownerId: actor.id };
  return null;
}
