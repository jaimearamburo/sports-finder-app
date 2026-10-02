// Plain date-math helpers with no DB/server dependency, so both
// lib/availability.ts (server-side) and the slot picker components
// (client-side) can share the exact same calendar-day normalization
// instead of each defining their own copy.

export function startOfUTCDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
