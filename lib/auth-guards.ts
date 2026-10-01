import "server-only";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import type { UserRole } from "../generated/prisma/enums";

export type AuthResult = { ok: false; error: string };

// Wraps a Data Access Layer function so it can only ever run with a real
// session - there's no path to a `session` argument except through this
// check, so a function written this way can't forget it the way a plain
// `if (!session) ...` inside the function body could. See AUTHORIZATION
// in CLAUDE.md for why this exists as a wrapper instead of a per-function
// check.
export function withAuth<Args extends unknown[], Result>(
  fn: (session: Session, ...args: Args) => Promise<Result>
): (...args: Args) => Promise<Result | AuthResult> {
  return async (...args: Args) => {
    const session = await auth();
    if (!session) return { ok: false, error: "You must be logged in." };
    return fn(session, ...args);
  };
}

// Same guarantee as withAuth, plus a role check. This is the one wrapper
// for every role combination - pass whichever roles are allowed
// (withRole(["admin"], fn), withRole(["admin", "venue_owner"], fn), etc.)
// rather than writing a separate wrapper per role.
export function withRole<Args extends unknown[], Result>(
  allowedRoles: UserRole[],
  fn: (session: Session, ...args: Args) => Promise<Result>
) {
  return withAuth<Args, Result | AuthResult>(async (session, ...args) => {
    if (!allowedRoles.includes(session.user.role)) {
      return { ok: false, error: "You don't have permission to do this." };
    }
    return fn(session, ...args);
  });
}
