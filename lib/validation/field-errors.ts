import { z } from "zod";

// The first Zod message per field, keyed by field name: the error shape every
// form renders, from client or server validation alike.
export function getFieldErrors<T>(error: z.ZodError<T>): Partial<Record<keyof T, string>> {
  const fieldErrors = z.flattenError(error).fieldErrors as Partial<Record<keyof T, string[]>>;
  const result: Partial<Record<keyof T, string>> = {};
  for (const key in fieldErrors) {
    const first = fieldErrors[key]?.[0];
    if (first) result[key] = first;
  }
  return result;
}
