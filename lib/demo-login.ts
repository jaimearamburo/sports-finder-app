import { z } from "zod";

// One-click demo logins on the login page: "Log in as venue owner" and "Log
// in as regular user", for people trying the app without signing up.
//
// No password is involved anywhere. The buttons send only which demo they
// want ("owner" or "user"); the server maps that to an account from the
// environment and signs it in through its own Auth.js provider ("demo",
// see auth.ts). So nothing secret is ever in the page, and the demo
// accounts' real passwords (if they have any) stay private.
//
// Settings (server-side env vars):
// - DEMO_LOGIN_ENABLED=true turns it on; anything else and the buttons
//   don't render and the provider refuses every request.
// - DEMO_OWNER_EMAIL / DEMO_USER_EMAIL: the accounts each button signs in.
//
// Demo visitors can do anything those accounts can, including editing the
// owner's venues and listings - a deliberate choice for a portfolio demo.
// Admin accounts are always refused (see auth.ts), so a misconfigured email
// can never hand admin rights to the public.

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
