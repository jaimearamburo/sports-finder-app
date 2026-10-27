import { z } from "zod";

// Trimmed and lowercased before the format check, so "  Jane@Example.com "
// is accepted and handled as "jane@example.com". For account emails this
// matters beyond tidiness: Postgres string equality is case-sensitive and
// email is User's only unique identifier, so signup and login must
// normalise identically or the same person could end up unable to log in.
// Reused for checkout's attendee email so every email in the app is
// normalised the same way. 254 is the practical maximum length of an email
// address; anything longer can only be junk.
export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, { error: "Enter a valid email address." })
  .pipe(z.email({ error: "Enter a valid email address." }));

// Cap for free-text name fields (account name, attendee name) - generous
// for any real name, but stops a crafted request storing megabytes in a
// column that's rendered on every booking.
export const NAME_MAX_LENGTH = 100;
