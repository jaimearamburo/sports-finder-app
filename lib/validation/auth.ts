import { z } from "zod";
import { emailField, NAME_MAX_LENGTH } from "./common";

// bcrypt reads only the first 72 bytes, so longer passwords sharing those bytes
// would match; longer ones are rejected. Measured in UTF-8 bytes.
const BCRYPT_MAX_BYTES = 72;

// Shared by the signup/login forms (inline feedback) and their Server Actions
// (the real check: actions are public endpoints). Not server-only so both
// import it.

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

// Shape only, no minimum length: login never reveals why credentials were
// rejected.
export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1),
});
