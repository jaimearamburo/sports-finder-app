import { describe, expect, it } from "vitest";
import { getAccountLinks, getInitials, getRoleBadge } from "@/lib/account-nav";

describe("getRoleBadge", () => {
  it("labels venue owners and admins, but not regular users", () => {
    expect(getRoleBadge("venue_owner")).toBe("Venue owner");
    expect(getRoleBadge("admin")).toBe("Admin");
    expect(getRoleBadge("user")).toBeNull();
  });
});

describe("getInitials", () => {
  it("uses the first letters of up to two names", () => {
    expect(getInitials("Emma Collins", "e@example.com")).toBe("EC");
    expect(getInitials("mary ann van der berg", null)).toBe("MA");
    expect(getInitials("  Jamie  ", null)).toBe("J");
  });

  it("falls back to the email when there's no name", () => {
    expect(getInitials(null, "alex@example.com")).toBe("A");
    expect(getInitials("", "zoe@example.com")).toBe("Z");
    expect(getInitials(null, null)).toBe("?");
  });
});

describe("getAccountLinks", () => {
  it("gives dashboard users the dashboard and My Bookings", () => {
    expect(getAccountLinks("venue_owner").map((l) => l.label)).toEqual(["Dashboard", "My Bookings"]);
    expect(getAccountLinks("admin").map((l) => l.label)).toEqual(["Dashboard", "My Bookings"]);
  });

  it("gives regular users their account area", () => {
    expect(getAccountLinks("user")).toEqual([{ label: "My Account", href: "/account" }]);
  });
});
