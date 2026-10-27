"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";

// Per-field validation messages, shown under the matching input. A field
// is only present here if it actually failed; the form checks
// `errors?.name` etc. to decide what to render.
type SignupErrors = {
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

// Deliberately loose ("something@something.something") rather than a
// strict RFC 5322 email regex. This is just a first-pass sanity check to
// reject obvious typos before hitting the database; Prisma's `@unique`
// constraint and the real-world act of receiving mail are the actual
// sources of truth, since no regex fully validates that an email is
// deliverable.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signup(
  _prevState: SignupFormState,
  formData: FormData
): Promise<SignupFormState> {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  // Normalized to lowercase here (and in auth.ts's login lookup) so a
  // "Jane@Example.com" signup and a "jane@example.com" login later refer
  // to the same row. Postgres string equality is case-sensitive, and
  // email is the only unique identifier on User.
  const email = ((formData.get("email") as string | null)?.trim() ?? "").toLowerCase();
  const password = (formData.get("password") as string | null) ?? "";

  const errors: SignupErrors = {};
  if (!name) errors.name = "Name is required.";
  if (!EMAIL_PATTERN.test(email)) errors.email = "Enter a valid email address.";
  if (password.length < 8) errors.password = "Password must be at least 8 characters.";

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

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
