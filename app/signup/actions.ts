"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";
import { signupSchema } from "@/lib/validation/auth";
import { getFieldErrors } from "@/lib/validation/field-errors";

// Per-field validation messages, shown under the matching input. A field
// is only present here if it actually failed; the form checks
// `errors?.name` etc. to decide what to render. Exported so SignupForm's
// own client-side check (same schema) can produce the same shape.
export type SignupErrors = {
  name?: string;
  email?: string;
  password?: string;
};

// The shape `useActionState` threads between renders of the signup form:
// `errors` for field-level problems (bad email, short password, ...),
// `message` for a whole-form problem that isn't tied to one input (e.g. the
// account was created but the automatic sign-in step failed). `undefined`
// is the initial state, before the form has ever been submitted.
export type SignupFormState = { errors?: SignupErrors; message?: string } | undefined;

export async function signup(
  _prevState: SignupFormState,
  formData: FormData
): Promise<SignupFormState> {
  // Re-validated here even though SignupForm runs the same schema first -
  // this action is a public endpoint and the client check can be skipped
  // entirely. The schema also trims/lowercases email (see
  // lib/validation/auth.ts for why that normalisation matters).
  const parsed = signupSchema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
  });
  if (!parsed.success) {
    return { errors: getFieldErrors(parsed.error) };
  }
  const { name, email, password } = parsed.data;

  // Checks whether an account with this email already exists.
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    // Deliberately generic: don't reveal whether this email already has a
    // password account or was created via Google sign-in.
    return { errors: { email: "An account with this email already exists." } };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  // Creates the new user account.
  await prisma.user.create({ data: { name, email, passwordHash } });

  try {
    // Sign the new user in immediately rather than sending them to log in
    // again with what they just typed.
    await signIn("credentials", { email, password, redirectTo: "/" });
  } catch (error) {
    // signIn's success path redirects internally by throwing a special
    // Next.js error that isn't an AuthError. Only rethrowing an actual
    // AuthError here avoids swallowing that redirect.
    if (error instanceof AuthError) {
      return {
        message: "Account created, but automatic sign-in failed. Please log in.",
      };
    }
    throw error;
  }
}
