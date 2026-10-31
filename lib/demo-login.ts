import { z } from "zod";

// One-click demo logins on the login page ("Log in as venue owner" / "Log in as
// regular user").
//
// No password is involved: the buttons send only "owner" or "user", and the
// server maps that to an account from the environment and signs it in through
// the "demo" provider (auth.ts).
//
// Server env vars:
// - DEMO_LOGIN_ENABLED=true enables it; otherwise the buttons don't render and
//   the provider refuses.
// - DEMO_OWNER_EMAIL / DEMO_USER_EMAIL: the accounts each button signs in.
//
// Demo visitors can do anything those accounts can (a deliberate choice for a
// portfolio demo). Admin accounts are always refused.

export const DEMO_ACCOUNTS = ["owner", "user"] as const;
export type DemoAccount = (typeof DEMO_ACCOUNTS)[number];

export const demoAccountSchema = z.enum(DEMO_ACCOUNTS);

export function isDemoLoginEnabled(): boolean {
  return process.env.DEMO_LOGIN_ENABLED === "true";
}

// The email a demo button signs in as, or null when demo logins are off or
// that account isn't configured.
export function demoAccountEmail(account: DemoAccount): string | null {
  if (!isDemoLoginEnabled()) return null;
  const email = account === "owner" ? process.env.DEMO_OWNER_EMAIL : process.env.DEMO_USER_EMAIL;
  return email?.trim().toLowerCase() || null;
}
