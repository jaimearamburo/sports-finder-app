import { z } from "zod";
import { emailField } from "./common";

// Shared by the signup/login forms (instant client-side feedback) and their
// Server Actions (the check that actually matters - an action is a public
// POST endpoint, reachable without ever loading the form). A plain module,
// not server-only, precisely so both sides import the same rules.

export const signupSchema = z.object({
  name: z.string().trim().min(1, { error: "Name is required." }),
  email: emailField,
  password: z.string().min(8, { error: "Password must be at least 8 characters." }),
});

// Only a shape check - no minimum length here, unlike signup. Login must
// never reveal *why* credentials were rejected (see app/login/actions.ts),
// and a length rule would just be another way of saying "that can't be
// your password".
export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1),
});
