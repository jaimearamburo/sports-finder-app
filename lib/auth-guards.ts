import "server-only";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { can, type Permission } from "@/lib/authz/permissions";

export type AuthResult = { ok: false; error: string };

// Wraps a Data Access Layer function so it can only ever run with a real
// session. There is no path to a `session` argument except through this
// check, so a wrapped function cannot forget it the way a plain
// `if (!session) ...` inside the function body could.
export function withAuth<Args extends unknown[], Result>(
  fn: (session: Session, ...args: Args) => Promise<Result>
): (...args: Args) => Promise<Result | AuthResult> {
  return async (...args: Args) => {
    // Reads the current session from the request cookie.
    const session = await auth();
    if (!session) return { ok: false, error: "You must be logged in." };
    return fn(session, ...args);
  };
}

// Same guarantee as withAuth, plus a permission check (see
// lib/authz/permissions.ts for which roles hold which permissions). The
// role-level check only - a function acting on one venue or listing must
// still load it and ask the matching policy in lib/authz/policies.ts
// (e.g. canManageVenue), since holding "venues:manage" doesn't mean owning
// that particular venue.
export function withPermission<Args extends unknown[], Result>(
  permission: Permission,
  fn: (session: Session, ...args: Args) => Promise<Result>
) {
  return withAuth<Args, Result | AuthResult>(async (session, ...args) => {
    if (!can(session.user, permission)) {
      return { ok: false, error: "You don't have permission to do this." };
    }
    return fn(session, ...args);
  });
}

// The page-level counterpart of withPermission: the first line of every
// protected page, returning the session for the page to use. Pages check
// for themselves rather than relying on a shared layout, because layouts
// don't re-render on client-side navigation (Next.js's authentication
// guide warns about exactly this).
//
// Not allowed renders the not-found page rather than a 403, so the area
// doesn't confirm it exists to someone who can't use it. Signed-out
// visitors are normally sent to /login by proxy.ts before reaching here;
// the redirect below covers any route the proxy doesn't match.
export async function requirePermission(permission: Permission): Promise<Session> {
  const session = await auth();
  if (!session) redirect("/login");
  if (!can(session.user, permission)) notFound();
  return session;
}
