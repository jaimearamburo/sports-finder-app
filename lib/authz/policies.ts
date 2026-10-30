import { can, type RoleHolder } from "@/lib/authz/permissions";

// Record-level rules: what a user may do with one particular venue or
// listing. permissions.ts answers "may venue managers edit listings at
// all?"; these answer "may this manager edit this listing?". Holding the
// role alone isn't enough - a venue_owner may only touch venues whose
// ownerId is their own.
//
// Pure functions over plain data, so the data layer loads the record and
// asks, and the same rules are unit-tested without a database.

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

// The filter to apply to Venue queries so a list only ever contains venues
// this actor may manage: every venue for an admin, only their own for an
// owner. Returned as a plain object that matches Prisma's Venue `where`
// shape, so list queries scope themselves the same way the single-record
// checks above do. Returns null when the actor may manage nothing, so the
// caller skips the query instead of risking an unfiltered one.
export function manageableVenuesWhere(actor: Actor | null | undefined): { ownerId?: string } | null {
  if (!actor) return null;
  if (can(actor, "venues:manage-all")) return {};
  if (can(actor, "venues:manage")) return { ownerId: actor.id };
  return null;
}
