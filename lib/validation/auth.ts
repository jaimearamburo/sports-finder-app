import { z } from "zod";
import { emailField, NAME_MAX_LENGTH } from "./common";

// bcrypt only reads the first 72 *bytes* of a password and silently ignores
// the rest, so two long passwords sharing their first 72 bytes would both
// log in. Rejecting longer ones makes that impossible. Measured in UTF-8
// bytes, not characters - an emoji or accented letter takes several.
const BCRYPT_MAX_BYTES = 72;

// Shared by the signup/login forms (instant client-side feedback) and their
// Server Actions (the check that actually matters - an action is a public
// POST endpoint, reachable without ever loading the form). A plain module,
// not server-only, precisely so both sides import the same rules.

export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Name is required." })
    .max(NAME_MAX_LENGTH, { error: `Name must be ${NAME_MAX_LENGTH} characters or fewer.` }),
  email: emailField,
  password: z
    .string()
    .min(8, { error: "Password must be at least 8 characters." })
    .refine((p) => new TextEncoder().encode(p).length <= BCRYPT_MAX_BYTES, {
      error: "Password is too long.",
    }),
});

// Only a shape check - no minimum length here, unlike signup. Login must
// never reveal *why* credentials were rejected (see app/login/actions.ts),
// and a length rule would just be another way of saying "that can't be
// your password".
export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1),
});
