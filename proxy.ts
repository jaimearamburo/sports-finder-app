import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/authz/permissions";
import { findRouteRule } from "@/lib/authz/route-access";

// Optimistic route protection (Next.js's `proxy.ts`, formerly middleware), run
// before rendering. `auth(...)` decodes the JWT into req.auth, so no database
// access. Not the real protection: pages call requirePermission() and data
// functions use withPermission(), since the proxy only sees the cookie and
// Server Actions bypass pages. Rules live in lib/authz/route-access.ts.
export default auth((req) => {
  const rule = findRouteRule(req.nextUrl.pathname);
  if (!rule) return NextResponse.next();

  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Signed in without the permission: back to home, not an error page.
  if (rule.permission && !can(req.auth.user, rule.permission)) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
});

// Skip static assets, image optimisation and Auth.js's API routes (needed to
// complete sign-in).
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
