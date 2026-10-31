"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";
import { signupSchema } from "@/lib/validation/auth";
import { getFieldErrors } from "@/lib/validation/field-errors";

// Per-field messages; a field is present only if it failed. Exported so
// SignupForm's client check produces the same shape.
export type SignupErrors = {
  name?: string;
  email?: string;
  password?: string;
};

// useActionState's state: `errors` per field, `message` for form-wide problems
// (e.g. sign-in after signup failed). undefined before the first submit.
export type SignupFormState = { errors?: SignupErrors; message?: string } | undefined;

export async function signup(
  _prevState: SignupFormState,
  formData: FormData
): Promise<SignupFormState> {
  // Re-validated here: the action is a public endpoint. The schema also trims
  // and lowercases the email.
  const parsed = signupSchema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
  });
  if (!parsed.success) {
    return { errors: getFieldErrors(parsed.error) };
  }
  const { name, email, password } = parsed.data;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    // Reveals the email is registered: an accepted gap without email
    // verification (rate limiting is deferred). Doesn't say whether the account
    // is password- or Google-based.
    return { errors: { email: "An account with this email already exists." } };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { name, email, passwordHash } });

  try {
    // Sign the new user in immediately.
    await signIn("credentials", { email, password, redirectTo: "/" });
  } catch (error) {
    // signIn redirects by throwing a Next.js error that isn't an AuthError;
    // only AuthErrors are handled here so the redirect isn't swallowed.
    if (error instanceof AuthError) {
      return {
        message: "Account created, but automatic sign-in failed. Please log in.",
      };
    }
    throw error;
  }
}
