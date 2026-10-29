import { z } from "zod";
import { PRICE_MIN, PRICE_MAX } from "@/lib/price-range";
import { startOfUTCDay } from "@/lib/dates";

// Browse filters come straight off the URL, so anyone can put anything
// there. Every field here falls back to "no filter" on bad input (.catch)
// rather than erroring - a mangled link should still show the browse
// page, just unfiltered.

const price = (fallback: number) =>
  z.coerce
    .number()
    .transform((n) => Math.min(Math.max(n, PRICE_MIN), PRICE_MAX))
    .catch(fallback);

const DATE_PARAM = /^\d{4}-\d{2}-\d{2}$/;

// Each entry costs real work per listing (a capacity query per date for
// time_range listings), so the list is capped rather than taken as given -
// before this, "?date=" repeated the same day thousands of times
// multiplied the queries accordingly. Two covers everything the UI ever
// writes: one picked day, or the "This weekend" Saturday+Sunday pair.
const MAX_DATES = 2;

// Generous for real use (there are far fewer tags than this) but bounds
// the size of the tag-name IN list sent to the database.
const MAX_TAGS = 20;

// More than enough for any real search (there are ten cities with venues);
// bounds the city IN list the same way MAX_TAGS bounds tags.
const MAX_CITIES = 10;

// Split out because the price pair is also read client-side, by the
// sidebar/mobile filter bar's URL routing hook (useSidebarFilterRouting).
// That reader used to do a bare Number(), so "?priceMin=abc" produced NaN,
// and the price slider's "has the URL value changed?" check (NaN !== NaN
// is always true) set state on every render forever - a crash any link
// could trigger. Both sides now parse through this same schema.
export const browsePriceSchema = z.object({
  priceMin: price(PRICE_MIN),
  priceMax: price(PRICE_MAX),
});

export const browseParamsSchema = browsePriceSchema.extend({
  // Each kept date is normalized to UTC midnight so it compares equal to
  // the Date objects getBookableDates/getSpotsRemaining produce and key by.
  // Malformed or impossible dates (e.g. 2026-02-31) are dropped, and
  // duplicates collapse to one.
  dates: z
    .string()
    .optional()
    .transform((raw) => {
      if (!raw) return [];
      const unique = [...new Set(raw.split(",").filter((d) => DATE_PARAM.test(d)))];
      return unique
        .map((d) => ({ text: d, date: startOfUTCDay(new Date(`${d}T00:00:00.000Z`)) }))
        // Round-trip check, not just "is it a valid Date": JS silently
        // rolls an impossible day over (2026-02-31 becomes 2026-03-03), so
        // only a date that formats back to exactly what was written is
        // kept.
        .filter(({ text, date }) => !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text)
        .map(({ date }) => date)
        .slice(0, MAX_DATES);
    })
    .catch([]),
  tags: z
    .string()
    .optional()
    .transform((raw) => (raw ? raw.split(",").filter(Boolean).slice(0, MAX_TAGS) : []))
    .catch([]),
  // One city, or several comma-separated ones (a search like "somewhere
  // warm" can match more than one - see lib/city-filter.ts). De-duplicated
  // and capped like tags.
  cities: z
    .string()
    .optional()
    .transform((raw) =>
      raw ? [...new Set(raw.split(",").map((c) => c.trim()).filter(Boolean))].slice(0, MAX_CITIES) : []
    )
    .catch([]),
});
