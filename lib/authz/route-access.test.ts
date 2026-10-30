import { describe, expect, it } from "vitest";
import { findRouteRule } from "@/lib/authz/route-access";

describe("findRouteRule", () => {
  it("protects the dashboard and everything under it", () => {
    expect(findRouteRule("/dashboard")?.permission).toBe("dashboard:access");
    expect(findRouteRule("/dashboard/venues/abc")?.permission).toBe("dashboard:access");
  });

  it("only needs a signed-in user for the account area", () => {
    expect(findRouteRule("/account")).toEqual({ path: "/account", permission: null });
  });

  it("matches whole path segments, not just a shared prefix", () => {
    expect(findRouteRule("/dashboards")).toBeNull();
    expect(findRouteRule("/accounting")).toBeNull();
  });

  it("leaves public pages alone", () => {
    expect(findRouteRule("/")).toBeNull();
    expect(findRouteRule("/listings/abc")).toBeNull();
    expect(findRouteRule("/login")).toBeNull();
  });
});
