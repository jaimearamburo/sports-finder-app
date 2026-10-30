import type { Permission } from "@/lib/authz/permissions";

// Which areas of the site need what. Read by proxy.ts to send people away
// early, before a page renders. That's a convenience, not the protection
// itself: each page also calls requirePermission() and every data function
// is wrapped in withPermission(), since the proxy only sees the session
// cookie and Server Actions can be called without visiting a page.
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

// Matches whole path segments, so "/dashboard" covers "/dashboard" and
// "/dashboard/venues" but not "/dashboards". When rules nest, the longest
// (most specific) one wins.
export function findRouteRule(pathname: string): RouteRule | null {
  let match: RouteRule | null = null;
  for (const rule of ROUTE_RULES) {
    const covers = pathname === rule.path || pathname.startsWith(`${rule.path}/`);
    if (covers && (!match || rule.path.length > match.path.length)) match = rule;
  }
  return match;
}
