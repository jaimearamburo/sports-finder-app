import "server-only";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { can, type Permission } from "@/lib/authz/permissions";

// `signedOut` lets callers tell "log in first" apart from other refusals
// without matching on the message.
export type AuthResult = { ok: false; error: string; signedOut?: true };

// Wraps a Data Access Layer function so it only runs with a session. The
// `session` argument can only come from this check, so a wrapped function can't
// skip it.
export function withAuth<Args extends unknown[], Result>(
  fn: (session: Session, ...args: Args) => Promise<Result>
): (...args: Args) => Promise<Result | AuthResult> {
  return async (...args: Args) => {
    const session = await auth();
    if (!session) return { ok: false, error: "You must be logged in.", signedOut: true };
    return fn(session, ...args);
  };
}

// withAuth plus a role-level permission check (lib/authz/permissions.ts).
// Functions acting on a specific venue or listing must still check ownership
// with the matching policy (lib/authz/policies.ts).
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

// The first line of every protected page; returns the session. Pages check for
// themselves because layouts don't re-render on client-side navigation.
//
// Refusal renders not-found rather than a 403, so the area isn't confirmed to
// exist. Signed-out visitors are normally redirected by proxy.ts; the redirect
// here covers routes it doesn't match.
export async function requirePermission(permission: Permission): Promise<Session> {
  const session = await auth();
  if (!session) redirect("/login");
  if (!can(session.user, permission)) notFound();
  return session;
}
