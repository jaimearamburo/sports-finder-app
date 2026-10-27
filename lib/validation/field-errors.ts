import { z } from "zod";

// One message per field (the first one Zod reports), keyed by field name -
// the shape every form in this app renders under its inputs. Shared so
// client-side and server-side validation of the same form produce
// identically-shaped errors from the same schema.
export function getFieldErrors<T>(error: z.ZodError<T>): Partial<Record<keyof T, string>> {
  const fieldErrors = z.flattenError(error).fieldErrors as Partial<Record<keyof T, string[]>>;
  const result: Partial<Record<keyof T, string>> = {};
  for (const key in fieldErrors) {
    const first = fieldErrors[key]?.[0];
    if (first) result[key] = first;
  }
  return result;
}
