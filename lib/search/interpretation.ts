import { z } from "zod";
import { PRICE_MIN, PRICE_MAX } from "@/lib/price-range";

// What natural-language search produces: the browse filters. The LLM
// (lib/llm.ts) and the keyword fallback (lib/search/keyword.ts) both output
// this shape, and interpretationToParams turns it into a browse URL, so results
// always come from the browse filters. No Next imports, so
// scripts/search-eval.ts can run it.

export type SearchVocabulary = {
  // Tag names as stored (what the browse `tags` param filters on).
  tags: string[];
  // City names as stored, plus a label with region/country - the label
  // gives the model geographic context for queries like "somewhere warm".
  cities: { name: string; label: string }[];
  // Each activity's tags (e.g. "Yoga Class -> Fitness, Classes"), so "yoga"
  // maps to the right tags.
  activities: { name: string; tags: string[] }[];
};

// Relative dates the model may return. It only classifies the phrase;
// resolveWhenToDateParam does the date maths.
export const WHEN_VALUES = [
  "none",
  "today",
  "tomorrow",
  "this_weekend",
  "next_weekend",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "specific_date",
] as const;
export type When = (typeof WHEN_VALUES)[number];

// The booking-mechanic axis (lib/category-filters.ts); single-valued because
// browse filters one type or all.
export const BOOKING_TYPES = ["time_range", "fixed_session", "date_range"] as const;

// Built per request from the cached vocabulary, so tags and cities can only be
// real database values.
export function buildInterpretationSchema(vocabulary: SearchVocabulary) {
  const tagEnum = vocabulary.tags.length > 0 ? z.enum(vocabulary.tags as [string, ...string[]]) : z.never();
  const cityEnum =
    vocabulary.cities.length > 0
      ? z.enum(vocabulary.cities.map((c) => c.name) as [string, ...string[]])
      : z.never();
  return z.object({
    tags: z.array(tagEnum),
    cities: z.array(cityEnum),
    bookingType: z.enum(BOOKING_TYPES).nullable(),
    when: z.enum(WHEN_VALUES),
    // Only used when `when` is "specific_date"; validated again in
    // resolveWhenToDateParam.
    specificDate: z.string().nullable(),
    priceMin: z.number().nullable(),
    priceMax: z.number().nullable(),
  });
}

export type Interpretation = z.infer<ReturnType<typeof buildInterpretationSchema>>;

export const EMPTY_INTERPRETATION: Interpretation = {
  tags: [],
  cities: [],
  bookingType: null,
  when: "none",
  specificDate: null,
  priceMin: null,
  priceMax: null,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS: When[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const DATE_PARAM = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(param: string): Date {
  return new Date(`${param}T00:00:00.000Z`);
}

function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isRealDate(param: string): boolean {
  return DATE_PARAM.test(param) && formatDay(parseDay(param)) === param;
}

// A `when` as the browse `date` param ("yyyy-mm-dd" or a Saturday,Sunday pair),
// relative to the viewer's today. "this weekend" uses the "This weekend" pill's
// rule, so the pill lights up. Weekday names mean the next one on or after
// today.
export function resolveWhenToDateParam(when: When, specificDate: string | null, today: string): string | undefined {
  const base = parseDay(today);
  const plus = (days: number) => formatDay(new Date(base.getTime() + days * DAY_MS));
  const dow = base.getUTCDay();
  const weekend = (offset: number) => `${plus((6 - dow + 7) % 7 + offset)},${plus((0 - dow + 7) % 7 + offset)}`;

  switch (when) {
    case "none":
      return undefined;
    case "today":
      return today;
    case "tomorrow":
      return plus(1);
    case "this_weekend":
      return weekend(0);
    case "next_weekend":
      return weekend(7);
    case "specific_date":
      return specificDate && isRealDate(specificDate) && specificDate >= today ? specificDate : undefined;
    default: {
      const target = WEEKDAYS.indexOf(when);
      return plus((target - dow + 7) % 7);
    }
  }
}

// The browse query for an interpretation. `q` keeps the original text for the
// search box and the interpretation chips. Prices are clamped to the slider's
// range.
export function interpretationToParams(interpretation: Interpretation, query: string, today: string): URLSearchParams {
  const params = new URLSearchParams({ q: query });
  // Lowercase, as the tag tiles write and compare them, so the tiles highlight.
  if (interpretation.tags.length > 0) {
    params.set("tags", [...new Set(interpretation.tags.map((t) => t.toLowerCase()))].join(","));
  }
  if (interpretation.cities.length > 0) params.set("city", [...new Set(interpretation.cities)].join(","));
  if (interpretation.bookingType) params.set("category", interpretation.bookingType);

  const date = resolveWhenToDateParam(interpretation.when, interpretation.specificDate, today);
  if (date) params.set("date", date);

  const clamp = (n: number) => Math.round(Math.min(Math.max(n, PRICE_MIN), PRICE_MAX));
  if (interpretation.priceMin !== null && clamp(interpretation.priceMin) > PRICE_MIN) {
    params.set("priceMin", String(clamp(interpretation.priceMin)));
  }
  if (interpretation.priceMax !== null && clamp(interpretation.priceMax) < PRICE_MAX) {
    params.set("priceMax", String(clamp(interpretation.priceMax)));
  }
  return params;
}
