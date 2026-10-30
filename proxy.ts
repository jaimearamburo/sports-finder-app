import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/authz/permissions";
import { findRouteRule } from "@/lib/authz/route-access";

// Route protection. Next.js renamed the old `middleware.ts` convention to
// `proxy.ts` - see node_modules/next/dist/docs/01-app/03-api-reference/03-
// file-conventions/proxy.md. This runs once per matched request, before
// rendering.
//
// `auth(...)` wraps our callback and populates `req.auth` with the decoded
// JWT session (or null), so this check never hits the database. It's an
// "optimistic" check in the Next.js authentication guide's terms: it turns
// people away early, but it isn't the protection itself. Each protected
// page calls requirePermission() and every data function is wrapped in
// withPermission() (lib/auth-guards.ts), since this only sees the cookie
// and Server Actions can be called without loading a page.
//
// Which paths need what lives in lib/authz/route-access.ts, not here.
export default auth((req) => {
  const rule = findRouteRule(req.nextUrl.pathname);
  if (!rule) return NextResponse.next();

  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Signed in, but without the permission this area needs (e.g. a regular
  // user opening /dashboard): back to the home page, not an error page -
  // there's nothing they can do about it, and nothing they need to know.
  if (rule.permission && !can(req.auth.user, rule.permission)) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
});

// Exclude static assets, image optimization, and Auth.js's own API routes
// (must stay reachable to actually complete a login) from Proxy.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
