import { describe, expect, it } from "vitest";
import { can, PERMISSIONS } from "@/lib/authz/permissions";

describe("can", () => {
  it("gives regular users no dashboard permissions", () => {
    for (const permission of PERMISSIONS) {
      expect(can({ role: "user" }, permission)).toBe(false);
    }
  });

  it("lets venue owners use the dashboard and manage their own venues", () => {
    expect(can({ role: "venue_owner" }, "dashboard:access")).toBe(true);
    expect(can({ role: "venue_owner" }, "venues:create")).toBe(true);
    expect(can({ role: "venue_owner" }, "venues:manage")).toBe(true);
  });

  it("doesn't let venue owners manage other owners' venues", () => {
    expect(can({ role: "venue_owner" }, "venues:manage-all")).toBe(false);
  });

  it("gives admins every permission", () => {
    for (const permission of PERMISSIONS) {
      expect(can({ role: "admin" }, permission)).toBe(true);
    }
  });

  it("allows nothing when signed out", () => {
    for (const permission of PERMISSIONS) {
      expect(can(null, permission)).toBe(false);
      expect(can(undefined, permission)).toBe(false);
    }
  });
});
