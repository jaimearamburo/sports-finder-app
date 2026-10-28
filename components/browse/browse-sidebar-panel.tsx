"use client";

import { startTransition, useOptimistic, useState } from "react";
import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/lib/category-filters";
import { PRICE_MIN, PRICE_MAX, PRICE_STEP } from "@/lib/price-range";
import { CATEGORY_LABEL_TEXT_CLASS } from "@/lib/label-styles";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import type { BrowseCityGroup } from "@/lib/browse-cities";

export type SidebarFilterValues = {
  category: string;
  city: string;
  priceMin: number;
  priceMax: number;
};

// Renders every sidebar filter (category, city, price) with no knowledge of
// URLs or routing. BrowseSidebar owns the URL logic and passes a plain
// callback down; this component owns the optimistic display and pending
// state for all of them and calls that callback inside its own transition.
// Separating a component that reads useSearchParams() from one that manages
// useOptimistic/startTransition state keeps rapid filter changes from
// contending with each other during rerenders, the same pattern TagFilters
// and TagFilterChips use. Category is the only control for the
// booking-mechanic axis (see lib/category-filters.ts); there is no
// separate booking-type control.
export function BrowseSidebarPanel({
  cities,
  category,
  city,
  priceMin,
  priceMax,
  changeAction,
}: SidebarFilterValues & {
  cities: BrowseCityGroup[];
  changeAction: (next: SidebarFilterValues) => void;
}) {
  const [optimistic, setOptimistic] = useOptimistic<SidebarFilterValues>({
    category,
    city,
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
          <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            City
          </h2>
          <Select
            // Flat list for value resolution (the trigger needs to look up
            // a selected city's label without walking the grouped JSX
            // below) - the grouping itself is purely a SelectContent
            // rendering concern.
            items={[
              { label: "All cities", value: "all" },
              ...cities.flatMap((group) => group.cities.map((c) => ({ label: c.label, value: c.name }))),
            ]}
            value={optimistic.city === "" ? "all" : optimistic.city}
            onValueChange={(value) =>
              commitFilters({ ...optimistic, city: !value || value === "all" ? "" : value })
            }
          >
            {/* aria-label: the visible "City" heading above isn't tied to
                this control, so without it a screen reader announced an
                unnamed combobox. The selected value is announced as well. */}
            <SelectTrigger className="w-full" aria-label="City">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cities</SelectItem>
              <SelectSeparator />
              {cities.map((group) => (
                <SelectGroup key={group.countryName}>
                  <SelectLabel className="bg-muted">{group.countryName}</SelectLabel>
                  {group.cities.map((c) => (
                    <SelectItem key={c.name} value={c.name}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>

        <PriceRangeFilter
          priceMin={optimistic.priceMin}
          priceMax={optimistic.priceMax}
          onCommit={(min, max) => commitFilters({ ...optimistic, priceMin: min, priceMax: max })}
        />
      </div>
    </div>
  );
}

function PriceRangeFilter({
  priceMin,
  priceMax,
  onCommit,
}: {
  priceMin: number;
  priceMax: number;
  onCommit: (min: number, max: number) => void;
}) {
  return (
    <div className="border-t pt-4">
      <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Price range
      </h2>
      <PriceRangeSlider priceMin={priceMin} priceMax={priceMax} onCommit={onCommit} />
    </div>
  );
}

// The value-display + slider only, with no heading or wrapper of its own -
// factored out so MobileFilterBar's price popover can reuse the exact same
// drag-tracking behavior inside its own container instead of duplicating
// it. The slider fires onValueChange continuously while dragging and
// onValueCommitted once when the drag ends. Tracking the dragged position
// in local state and only calling commit() on release keeps every
// intermediate pointer position from becoming its own URL update and
// browser history entry.
export function PriceRangeSlider({
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
    <>
      <div className="mb-3 flex justify-between font-mono text-xs text-muted-foreground">
        <span>{liveValue[0] === PRICE_MIN ? "Free" : `$${liveValue[0]}`}</span>
        <span>{liveValue[1] >= PRICE_MAX ? `$${PRICE_MAX}+` : `$${liveValue[1]}`}</span>
      </div>
      <Slider
        min={PRICE_MIN}
        max={PRICE_MAX}
        step={PRICE_STEP}
        value={liveValue}
        getThumbAriaLabel={(index) => (index === 0 ? "Minimum price" : "Maximum price")}
        onValueChange={(value) => setLiveValue(value as [number, number])}
        onValueCommitted={(value) => {
          const [min, max] = value as [number, number];
          onCommit(min, max);
        }}
      />
    </>
  );
}
