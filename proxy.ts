import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Route protection (ticket 2.8). Next.js renamed the old `middleware.ts`
// convention to `proxy.ts` — see node_modules/next/dist/docs/01-app/03-api-
// reference/03-file-conventions/proxy.md. This still runs once per matched
// request, before rendering.
//
// `auth(...)` wraps our callback and populates `req.auth` with the decoded
// JWT session (or null), so this check never hits the database — it's an
// "optimistic" check per the Next.js auth guide, cheap enough to run on
// every request.
//
// "/dashboard" and "/account" are currently just placeholder pages (see
// app/dashboard/page.tsx, app/account/page.tsx) added so we can test
// end-to-end login/logout/hit protected routes.
// Add further prefixes here as real protected pages
const protectedRoutes: string[] = ["/dashboard", "/account"];

export default auth((req) => {
  const isProtectedRoute = protectedRoutes.some((route) =>
    req.nextUrl.pathname.startsWith(route)
  );

  if (isProtectedRoute && !req.auth) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

// Exclude static assets, image optimization, and Auth.js's own API routes
// (must stay reachable to actually complete a login) from Proxy.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
