"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export type DevResetPasswordState = { error?: string; success?: boolean } | undefined;

/**
 * TEMPORARY DEV-ONLY TOOL. Deletable once a real forgot-password flow
 * (presumably email-link based) exists.
 *
 * Sets any account's password by email alone, with no proof of inbox
 * ownership. This is a full authentication bypass, acceptable only
 * because this is a solo local project with no real users yet. The
 * `NODE_ENV` check below is the actual safeguard: it makes this action a
 * no-op if it were ever accidentally deployed, since Vercel always sets
 * `NODE_ENV=production` for deployed builds. That check must stay in
 * place; it is the only thing standing between this file and a real
 * account-takeover vulnerability if this code ever ships.
 */
export async function devResetPassword(
  _prevState: DevResetPasswordState,
  formData: FormData
): Promise<DevResetPasswordState> {
  if (process.env.NODE_ENV === "production") {
    return { error: "This tool is disabled in production." };
  }

  const email = ((formData.get("email") as string | null)?.trim() ?? "").toLowerCase();
  const newPassword = (formData.get("newPassword") as string | null) ?? "";

  if (!email || !newPassword) {
    return { error: "Both fields are required." };
  }
  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }

  // Checks the account exists before attempting the update.
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { error: "No account found with that email." };
  }

  // Same hashing scheme and cost factor as app/signup/actions.ts: the
  // Credentials provider's `bcrypt.compare` in auth.ts needs a hash
  // produced the same way, or login will fail even though this succeeded.
  const passwordHash = await bcrypt.hash(newPassword, 10);
  // Writes the new password hash to the account.
  await prisma.user.update({ where: { email }, data: { passwordHash } });

  return { success: true };
}
