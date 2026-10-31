import { z } from "zod";

// Trimmed and lowercased before the format check. Email is the user's unique
// key and Postgres comparison is case-sensitive, so signup and login must
// normalise identically. Also used for attendee emails. 254 is the practical
// maximum email length.
export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, { error: "Enter a valid email address." })
  .pipe(z.email({ error: "Enter a valid email address." }));

// Cap for name fields (account and attendee names).
export const NAME_MAX_LENGTH = 100;
