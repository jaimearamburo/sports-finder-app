import { z } from "zod";

// The manager bookings page's filters, read from the URL. Every value falls
// back to "no filter" when it's missing or malformed, rather than failing
// the page - the same approach as the browse filters (lib/validation/
// browse.ts): a hand-edited or stale link should still show something
// sensible. Whether a venue or listing in the URL is one this user may see
// is checked against the database, not here.

export const WHEN_OPTIONS = ["upcoming", "past", "all"] as const;
export type BookingsWhen = (typeof WHEN_OPTIONS)[number];

export const BOOKINGS_PAGE_SIZE = 20;
// The longest date range the filter accepts. Matching dates is done
// precisely per venue in code (see lib/dashboard/bookings.ts), over the
// bookings in the range, so the range is kept to a size that stays quick.
export const MAX_RANGE_DAYS = 366;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const optionalId = z.string().trim().min(1).max(64).optional().catch(undefined);
const optionalDate = z
  .string()
  .regex(DATE_PATTERN)
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)))
  .optional()
  .catch(undefined);

const filtersSchema = z.object({
  when: z.enum(WHEN_OPTIONS).catch("upcoming"),
  venue: optionalId,
  listing: optionalId,
  from: optionalDate,
  to: optionalDate,
  q: z.string().trim().max(100).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type BookingFilters = {
  when: BookingsWhen;
  venue?: string;
  listing?: string;
  // "yyyy-mm-dd" calendar days, inclusive, read on each venue's clock.
  from?: string;
  to?: string;
  q?: string;
  page: number;
};

// URL search params (as Next passes them) to clean filters.
export function parseBookingFilters(params: Record<string, string | string[] | undefined>): BookingFilters {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const raw = filtersSchema.parse({
    when: first(params.when),
    venue: first(params.venue),
    listing: first(params.listing),
    from: first(params.from),
    to: first(params.to),
    q: first(params.q),
    page: first(params.page),
  });

  let { from, to } = raw;
  // A reversed range is read the way it was obviously meant.
  if (from && to && from > to) [from, to] = [to, from];
  // An over-long range is cut to its first MAX_RANGE_DAYS days.
  if (from && to) {
    const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS;
    if (days >= MAX_RANGE_DAYS) to = new Date(Date.parse(`${from}T00:00:00Z`) + (MAX_RANGE_DAYS - 1) * DAY_MS).toISOString().slice(0, 10);
  }
  return { when: raw.when, venue: raw.venue, listing: raw.listing, from, to, q: raw.q || undefined, page: raw.page };
}

// Clean filters back to a query string, leaving out defaults so URLs stay
// short. `changes` overrides individual values; anything that changes
// what's shown should reset the page, which callers do by passing page: 1.
export function bookingFiltersQuery(filters: BookingFilters, changes: Partial<BookingFilters> = {}): string {
  const next = { ...filters, ...changes };
  const params = new URLSearchParams();
  if (next.when !== "upcoming") params.set("when", next.when);
  if (next.venue) params.set("venue", next.venue);
  if (next.listing) params.set("listing", next.listing);
  if (next.from) params.set("from", next.from);
  if (next.to) params.set("to", next.to);
  if (next.q) params.set("q", next.q);
  if (next.page > 1) params.set("page", String(next.page));
  return params.toString();
}
