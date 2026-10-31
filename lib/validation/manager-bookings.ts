import { z } from "zod";

// The bookings page's URL filters. Missing or malformed values fall back to "no
// filter", like browse. Whether this user may see a venue or listing is checked
// against the database, not here.

export const WHEN_OPTIONS = ["upcoming", "past", "all"] as const;
export type BookingsWhen = (typeof WHEN_OPTIONS)[number];

export const BOOKINGS_PAGE_SIZE = 20;
// Longest accepted date range; dates are matched per venue in code, so the
// range is kept small.
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

// Filters back to a query string, omitting defaults. `changes` overrides
// values; callers reset paging with page: 1.
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
