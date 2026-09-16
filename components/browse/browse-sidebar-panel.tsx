"use client";

import { startTransition, useOptimistic, useState } from "react";
import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/lib/category-filters";
import { BOOKING_TYPES } from "@/lib/booking-types";
import { PRICE_MIN, PRICE_MAX, PRICE_STEP } from "@/lib/price-range";
import { CATEGORY_LABEL_TEXT_CLASS } from "@/lib/label-styles";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

export type SidebarFilterValues = {
  category: string;
  city: string;
  types: Set<string>;
  priceMin: number;
  priceMax: number;
};

// Renders every sidebar filter (category, city, booking type, price) with
// no knowledge of URLs or routing. BrowseSidebar owns the URL logic and
// passes a plain callback down; this component owns the optimistic display
// and pending state for all of them and calls that callback inside its own
// transition. Separating a component that reads useSearchParams() from one
// that manages useOptimistic/startTransition state keeps rapid filter
// changes from contending with each other during rerenders, the same
// pattern used to split TagFilters from TagFilterChips.
export function BrowseSidebarPanel({
  cities,
  category,
  city,
  types,
  priceMin,
  priceMax,
  changeAction,
}: SidebarFilterValues & {
  cities: string[];
  changeAction: (next: SidebarFilterValues) => void;
}) {
  const [optimistic, setOptimistic] = useOptimistic<SidebarFilterValues>({
    category,
    city,
    types,
    priceMin,
    priceMax,
  });
  const [isPending, setIsPending] = useOptimistic(false);

  function commitFilters(next: SidebarFilterValues) {
    startTransition(() => {
      setOptimistic(next);
      setIsPending(true);
      changeAction(next);
    });
  }

  function toggleType(id: string) {
    const nextTypes = new Set(optimistic.types);
    if (nextTypes.has(id)) {
      nextTypes.delete(id);
    } else {
      nextTypes.add(id);
    }
    commitFilters({ ...optimistic, types: nextTypes });
  }

  return (
    <div data-pending={isPending ? "" : undefined}>
      <nav aria-label="Browse categories" className="flex flex-col">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => commitFilters({ ...optimistic, category: cat.id })}
            aria-current={optimistic.category === cat.id ? "true" : undefined}
            className={cn(
              "border-l-2 border-transparent px-2.5 py-2 text-left",
              CATEGORY_LABEL_TEXT_CLASS,
              "text-muted-foreground hover:bg-foreground/3 hover:text-foreground/80",
              optimistic.category === cat.id &&
                "border-primary bg-foreground/3 text-foreground/80"
            )}
          >
            {cat.label}
          </button>
        ))}
      </nav>

      <div className="mt-6 flex flex-col gap-6">
        <div className="border-t pt-4">
          <h3 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            City
          </h3>
          <Select
            items={[{ label: "All cities", value: "all" }, ...cities.map((c) => ({ label: c, value: c }))]}
            value={optimistic.city === "" ? "all" : optimistic.city}
            onValueChange={(value) =>
              commitFilters({ ...optimistic, city: !value || value === "all" ? "" : value })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cities</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <PriceRangeFilter
          priceMin={optimistic.priceMin}
          priceMax={optimistic.priceMax}
          onCommit={(min, max) => commitFilters({ ...optimistic, priceMin: min, priceMax: max })}
        />

        <div className="border-t pt-4">
          <h3 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Booking type
          </h3>
          <div className="flex flex-col gap-2.5">
            {BOOKING_TYPES.map((type) => (
              <label
                key={type.id}
                className="flex items-center gap-2.5 text-sm text-muted-foreground"
              >
                <input
                  type="checkbox"
                  className="size-3.75 accent-primary"
                  checked={optimistic.types.has(type.id)}
                  onChange={() => toggleType(type.id)}
                />
                {type.label}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// The slider fires onValueChange continuously while dragging and
// onValueCommitted once when the drag ends. Tracking the dragged position
// in local state and only calling commit() on release keeps every
// intermediate pointer position from becoming its own URL update and
// browser history entry.
function PriceRangeFilter({
  priceMin,
  priceMax,
  onCommit,
}: {
  priceMin: number;
  priceMax: number;
  onCommit: (min: number, max: number) => void;
}) {
  const [liveValue, setLiveValue] = useState<[number, number]>([priceMin, priceMax]);

  // Resets the dragged position whenever the committed value changes from
  // outside this component (a URL navigation, or an optimistic revert),
  // adjusted during render rather than in an effect so it takes effect in
  // the same commit instead of causing an extra one.
  const [prevCommitted, setPrevCommitted] = useState<[number, number]>([priceMin, priceMax]);
  if (prevCommitted[0] !== priceMin || prevCommitted[1] !== priceMax) {
    setPrevCommitted([priceMin, priceMax]);
    setLiveValue([priceMin, priceMax]);
  }

  return (
    <div className="border-t pt-4">
      <h3 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Price range
      </h3>
      <div className="mb-3 flex justify-between font-mono text-xs text-muted-foreground">
        <span>${liveValue[0]}</span>
        <span>{liveValue[1] >= PRICE_MAX ? `$${PRICE_MAX}+` : `$${liveValue[1]}`}</span>
      </div>
      <Slider
        min={PRICE_MIN}
        max={PRICE_MAX}
        step={PRICE_STEP}
        value={liveValue}
        onValueChange={(value) => setLiveValue(value as [number, number])}
        onValueCommitted={(value) => {
          const [min, max] = value as [number, number];
          onCommit(min, max);
        }}
      />
    </div>
  );
}
