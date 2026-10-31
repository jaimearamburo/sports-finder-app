import { z } from "zod";
import { PRICE_MIN, PRICE_MAX } from "@/lib/price-range";
import { startOfUTCDay } from "@/lib/dates";

// Browse filters come from the URL, so every field falls back to "no filter" on
// bad input (.catch) rather than erroring.

const price = (fallback: number) =>
  z.coerce
    .number()
    .transform((n) => Math.min(Math.max(n, PRICE_MIN), PRICE_MAX))
    .catch(fallback);

const DATE_PARAM = /^\d{4}-\d{2}-\d{2}$/;

// Each date costs queries per listing, so the list is capped. Two covers what
// the UI writes: one day, or the weekend pair.
const MAX_DATES = 2;

// Bounds the tag IN list sent to the database.
const MAX_TAGS = 20;

// Bounds the city IN list.
const MAX_CITIES = 10;

// Separate because the sidebar and mobile filter bar also parse the price pair
// client-side; an unparsed NaN made the price slider re-render forever.
export const browsePriceSchema = z.object({
  priceMin: price(PRICE_MIN),
  priceMax: price(PRICE_MAX),
});

export const browseParamsSchema = browsePriceSchema.extend({
  // Each date is normalised to UTC midnight to match getBookableDates' keys.
  // Malformed or impossible dates are dropped and duplicates collapse.
  dates: z
    .string()
    .optional()
    .transform((raw) => {
      if (!raw) return [];
      const unique = [...new Set(raw.split(",").filter((d) => DATE_PARAM.test(d)))];
      return unique
        .map((d) => ({ text: d, date: startOfUTCDay(new Date(`${d}T00:00:00.000Z`)) }))
        // Round-trip check: JS rolls impossible days over (2026-02-31 becomes
        // 2026-03-03), so only dates that format back to the same text are
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
  // One city or several comma-separated (lib/city-filter.ts); de-duplicated and
  // capped.
  cities: z
    .string()
    .optional()
    .transform((raw) =>
      raw ? [...new Set(raw.split(",").map((c) => c.trim()).filter(Boolean))].slice(0, MAX_CITIES) : []
    )
    .catch([]),
});
