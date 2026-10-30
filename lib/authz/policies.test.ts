import { describe, expect, it } from "vitest";
import { canManageListing, canManageVenue, manageableVenuesWhere, type Actor } from "@/lib/authz/policies";

const owner: Actor = { id: "owner-1", role: "venue_owner" };
const otherOwner: Actor = { id: "owner-2", role: "venue_owner" };
const admin: Actor = { id: "admin-1", role: "admin" };
const user: Actor = { id: "user-1", role: "user" };

const venue = { ownerId: "owner-1" };
const listing = { venue };

describe("canManageVenue", () => {
  it("allows the venue's owner", () => {
    expect(canManageVenue(owner, venue)).toBe(true);
  });

  it("refuses a different owner", () => {
    expect(canManageVenue(otherOwner, venue)).toBe(false);
  });

  it("allows an admin for any venue", () => {
    expect(canManageVenue(admin, venue)).toBe(true);
  });

  it("refuses a regular user, even one whose id matches the owner", () => {
    // Ownership alone isn't enough: the role must allow managing venues.
    expect(canManageVenue({ id: "owner-1", role: "user" }, venue)).toBe(false);
    expect(canManageVenue(user, venue)).toBe(false);
  });

  it("refuses when signed out", () => {
    expect(canManageVenue(null, venue)).toBe(false);
  });
});

describe("canManageListing", () => {
  it("follows the listing's venue", () => {
    expect(canManageListing(owner, listing)).toBe(true);
    expect(canManageListing(otherOwner, listing)).toBe(false);
    expect(canManageListing(admin, listing)).toBe(true);
    expect(canManageListing(user, listing)).toBe(false);
  });
});

describe("manageableVenuesWhere", () => {
  it("limits an owner to their own venues", () => {
    expect(manageableVenuesWhere(owner)).toEqual({ ownerId: "owner-1" });
  });

  it("gives an admin every venue", () => {
    expect(manageableVenuesWhere(admin)).toEqual({});
  });

  it("returns null for anyone who may manage nothing, so no query runs", () => {
    expect(manageableVenuesWhere(user)).toBeNull();
    expect(manageableVenuesWhere(null)).toBeNull();
  });
});
