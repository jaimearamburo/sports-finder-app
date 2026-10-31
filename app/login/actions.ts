"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { sanitizeCallbackUrl, LOGIN_INVALID_INPUT_MESSAGE } from "./utils";
import { loginSchema } from "@/lib/validation/auth";
import { demoAccountSchema } from "@/lib/demo-login";

// One form-wide message, never per-field: login must not reveal whether the
// email or the password was wrong (see authorize() in auth.ts).
export type LoginFormState = { message?: string } | undefined;

export async function login(
  _prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const callbackUrl = sanitizeCallbackUrl((formData.get("callbackUrl") as string | null) ?? undefined);

  // Re-checked here since the action is a public endpoint; collapsed to the one
  // message.
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
    // signIn redirects by throwing a Next.js error that isn't an AuthError;
    // only an AuthError means the credentials were rejected.
    if (error instanceof AuthError) {
      return { message: "Invalid email or password." };
    }
    throw error;
  }
}

// The demo buttons (lib/demo-login.ts) send only which account; the "demo"
// provider decides the rest and refuses when demo logins are off. A refusal
// returns to the login page with a message.
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
