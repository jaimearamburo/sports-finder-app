"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { sanitizeCallbackUrl } from "./utils";

// A single whole-form message rather than per-field errors — unlike signup,
// we deliberately never say *which* of email/password was wrong (same
// reasoning as authorize()'s uniform `null` return in auth.ts: don't give an
// attacker a way to tell "wrong password" apart from "no such account").
export type LoginFormState = { message?: string } | undefined;

export async function login(
  _prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const email = ((formData.get("email") as string | null)?.trim() ?? "").toLowerCase();
  const password = (formData.get("password") as string | null) ?? "";
  const callbackUrl = sanitizeCallbackUrl((formData.get("callbackUrl") as string | null) ?? undefined);

  if (!email || !password) {
    return { message: "Enter your email and password." };
  }

  try {
    await signIn("credentials", { email, password, redirectTo: callbackUrl });
  } catch (error) {
    // signIn's success path redirects internally by throwing a special
    // Next.js error that is NOT an AuthError — only an actual AuthError
    // here means the credentials themselves were rejected by authorize().
    if (error instanceof AuthError) {
      return { message: "Invalid email or password." };
    }
    throw error;
  }
}
