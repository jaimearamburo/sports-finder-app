import { z } from "zod";

// Trimmed and lowercased before the format check, so "  Jane@Example.com "
// is accepted and handled as "jane@example.com". For account emails this
// matters beyond tidiness: Postgres string equality is case-sensitive and
// email is User's only unique identifier, so signup and login must
// normalise identically or the same person could end up unable to log in.
// Reused for checkout's attendee email so every email in the app is
// normalised the same way.
export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address." }));
