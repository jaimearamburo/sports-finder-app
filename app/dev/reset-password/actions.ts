"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export type DevResetPasswordState = { error?: string; success?: boolean } | undefined;

/**
 * Development-only tool, to be deleted once a forgot-password flow exists.
 *
 * Sets any account's password by email alone: an authentication bypass. The
 * NODE_ENV check below makes it a no-op on deployed builds (Vercel sets
 * NODE_ENV=production) and must stay.
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

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { error: "No account found with that email." };
  }

  // Same bcrypt cost as signup, so auth.ts's compare matches.
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { email }, data: { passwordHash } });

  return { success: true };
}
