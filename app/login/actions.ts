"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { sanitizeCallbackUrl, LOGIN_INVALID_INPUT_MESSAGE } from "./utils";
import { loginSchema } from "@/lib/validation/auth";
import { demoAccountSchema } from "@/lib/demo-login";

// A single whole-form message rather than per-field errors - unlike
// signup, this deliberately never says which of email/password was wrong,
// the same reasoning as authorize()'s uniform `null` return in auth.ts:
// don't give an attacker a way to tell "wrong password" apart from
// "no such account".
export type LoginFormState = { message?: string } | undefined;

export async function login(
  _prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const callbackUrl = sanitizeCallbackUrl((formData.get("callbackUrl") as string | null) ?? undefined);

  // Same schema LoginForm runs client-side, re-checked here since this
  // action is a public endpoint. Collapsed to one whole-form message on
  // purpose (see LoginFormState above) rather than per-field errors.
  const parsed = loginSchema.safeParse({
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
  });
  if (!parsed.success) {
    return { message: LOGIN_INVALID_INPUT_MESSAGE };
  }
  const { email, password } = parsed.data;

  try {
    await signIn("credentials", { email, password, redirectTo: callbackUrl });
  } catch (error) {
    // signIn's success path redirects internally by throwing a special
    // Next.js error that is not an AuthError. Only an actual AuthError
    // here means the credentials themselves were rejected by authorize().
    if (error instanceof AuthError) {
      return { message: "Invalid email or password." };
    }
    throw error;
  }
}

// The demo buttons (see lib/demo-login.ts). Sends only which demo account
// to use; the "demo" provider in auth.ts decides the rest, and refuses when
// demo logins are off. A refusal lands back on the login page with a
// message rather than an error page.
export async function demoLogin(account: unknown, rawCallbackUrl: unknown) {
  const callbackUrl = sanitizeCallbackUrl(typeof rawCallbackUrl === "string" ? rawCallbackUrl : undefined);
  const parsed = demoAccountSchema.safeParse(account);
  if (!parsed.success) return { message: "That demo account isn't available." };
  try {
    await signIn("demo", { account: parsed.data, redirectTo: callbackUrl });
  } catch (error) {
    if (error instanceof AuthError) return { message: "The demo isn't available right now." };
    throw error;
  }
}
