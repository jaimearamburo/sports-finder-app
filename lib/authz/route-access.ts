import type { Permission } from "@/lib/authz/permissions";

// Which site areas need which permission. proxy.ts reads this to redirect
// early; that's a convenience, not the protection: pages call
// requirePermission() and data functions use withPermission(), since the proxy
// only sees the cookie and Server Actions bypass pages.
//
// A rule covers its path and everything under it.
export type RouteRule = {
  path: string;
  // null: any signed-in user may enter.
  permission: Permission | null;
};

export const ROUTE_RULES: readonly RouteRule[] = [
  { path: "/dashboard", permission: "dashboard:access" },
  { path: "/account", permission: null },
];

// Matches whole segments ("/dashboard" covers "/dashboard/venues", not
// "/dashboards"). The longest matching rule wins.
export function findRouteRule(pathname: string): RouteRule | null {
  let match: RouteRule | null = null;
  for (const rule of ROUTE_RULES) {
    const covers = pathname === rule.path || pathname.startsWith(`${rule.path}/`);
    if (covers && (!match || rule.path.length > match.path.length)) match = rule;
  }
  return match;
}
