"use client";

import { useBrowseFilters } from "@/contexts/browse-navigation";
import { X } from "lucide-react";
import { CATEGORIES } from "@/lib/category-filters";
import { PRICE_MAX } from "@/lib/price-range";

type Chip = { key: string; label: string; remove: (params: URLSearchParams) => void };

function formatDay(param: string): string {
  const [y, m, d] = param.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

// Removes one value from a comma-separated param (tags, city), dropping
// the param entirely once it's empty.
function removeFromList(params: URLSearchParams, key: string, value: string) {
  const rest = (params.get(key) ?? "").split(",").filter((v) => v && v !== value);
  if (rest.length > 0) params.set(key, rest.join(","));
  else params.delete(key);
}

// Empties every browse param - what "Clear search" leaves behind.
export function clearAllParams(params: URLSearchParams) {
  for (const key of [...params.keys()]) params.delete(key);
}

// One chip per filter currently in the URL. Derived from the URL rather
// than from what the search originally returned, so chips stay accurate if
// the person then adjusts the sidebar or quick filters too.
function chipsFor(params: URLSearchParams): Chip[] {
  const chips: Chip[] = [];
  // Tags are lowercase in the URL (the tag tiles' convention), so they're
  // title-cased back for display: "table tennis" -> "Table Tennis".
  for (const tag of (params.get("tags") ?? "").split(",").filter(Boolean)) {
    const label = tag.replace(/\b\w/g, (c) => c.toUpperCase());
    chips.push({ key: `tag-${tag}`, label, remove: (p) => removeFromList(p, "tags", tag) });
  }
  for (const city of (params.get("city") ?? "").split(",").filter(Boolean)) {
    chips.push({ key: `city-${city}`, label: city, remove: (p) => removeFromList(p, "city", city) });
  }
  const category = CATEGORIES.find((c) => c.id !== "all" && c.id === params.get("category"));
  if (category) chips.push({ key: "category", label: category.label, remove: (p) => p.delete("category") });

  const date = params.get("date");
  if (date) {
    const days = date.split(",").filter(Boolean);
    chips.push({ key: "date", label: days.map(formatDay).join(" – "), remove: (p) => p.delete("date") });
  }

  const priceMin = Number(params.get("priceMin") ?? 0);
  const priceMax = params.has("priceMax") ? Number(params.get("priceMax")) : PRICE_MAX;
  if (priceMin > 0 || priceMax < PRICE_MAX) {
    const label =
      priceMax === 0
        ? "Free"
        : priceMin > 0 && priceMax < PRICE_MAX
          ? `$${priceMin} – $${priceMax}`
          : priceMin > 0
            ? `From $${priceMin}`
            : `Under $${priceMax}`;
    chips.push({
      key: "price",
      label,
      remove: (p) => {
        p.delete("priceMin");
        p.delete("priceMax");
      },
    });
  }
  return chips;
}

// How a natural-language search was understood (see searchAction), shown
// above the results while a search is active (`q` in the URL). Each chip
// can be removed to undo one part of the interpretation, which is the
// quick fix when the model reads a query differently than intended.
// Goes through useBrowseFilters like every other filter control, so a
// removed chip disappears straight away and the results dim while they load.
export function SearchInterpretation() {
  const { params, update } = useBrowseFilters();
  const q = params.get("q");
  if (!q) return null;

  const chips = chipsFor(params);

  function remove(chip: Chip) {
    update(chip.remove);
  }

  // Same as the header search box's clear button: the search and every
  // filter it set go, leaving plain browse.
  function clearSearch() {
    update(clearAllParams);
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
      {chips.length > 0 ? (
        <span className="text-muted-foreground">
          Showing results for <span className="font-medium text-foreground">“{q}”</span>
        </span>
      ) : (
        <span className="text-muted-foreground">
          Couldn&apos;t match <span className="font-medium text-foreground">“{q}”</span> to any filters, so
          everything is shown.
        </span>
      )}
      {chips.map((chip) => (
        <span key={chip.key} className="inline-flex items-center gap-1 rounded-full border bg-card py-1 pr-1 pl-3">
          {chip.label}
          <button
            type="button"
            onClick={() => remove(chip)}
            aria-label={`Remove ${chip.label}`}
            className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={clearSearch}
        className="inline-flex min-h-6 items-center px-1 text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Clear search
      </button>
    </div>
  );
}
