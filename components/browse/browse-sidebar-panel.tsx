"use client";

import { useState } from "react";
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
import { citySelectValue, MULTIPLE_CITIES_LABEL, MULTIPLE_CITIES_VALUE } from "@/lib/city-filter";

export type SidebarFilterValues = {
  category: string;
  city: string;
  priceMin: number;
  priceMax: number;
};

// Renders the sidebar filters (category, city, price) without any URL logic;
// BrowseSidebar passes a callback. Values already include a change still
// loading (useBrowseFilters), so clicks show immediately. Category is the only
// booking-mechanic control (lib/category-filters.ts).
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
  const current: SidebarFilterValues = { category, city, priceMin, priceMax };

  return (
    <div>
      <nav aria-label="Browse categories" className="flex flex-col">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => changeAction({ ...current, category: cat.id })}
            aria-current={current.category === cat.id ? "true" : undefined}
            className={cn(
              "border-l-2 border-transparent px-2.5 py-2 text-left",
              CATEGORY_LABEL_TEXT_CLASS,
              "text-muted-foreground hover:bg-foreground/3 hover:text-foreground/80",
              current.category === cat.id &&
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
            // Flat list so the trigger can look up the selected city's label;
            // grouping is only for rendering.
            items={[
              { label: "All cities", value: "all" },
              { label: MULTIPLE_CITIES_LABEL, value: MULTIPLE_CITIES_VALUE },
              ...cities.flatMap((group) => group.cities.map((c) => ({ label: c.label, value: c.name }))),
            ]}
            value={citySelectValue(current.city)}
            onValueChange={(value) => {
              if (value === MULTIPLE_CITIES_VALUE) return;
              changeAction({ ...current, city: !value || value === "all" ? "" : value });
            }}
          >
            {/* The "City" heading isn't tied to this control, so it's named
                here. */}
            <SelectTrigger className="w-full" aria-label="City">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cities</SelectItem>
              {current.city.includes(",") && (
                <SelectItem value={MULTIPLE_CITIES_VALUE} disabled>
                  {MULTIPLE_CITIES_LABEL}
                </SelectItem>
              )}
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
          priceMin={current.priceMin}
          priceMax={current.priceMax}
          onCommit={(min, max) => changeAction({ ...current, priceMin: min, priceMax: max })}
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

// The price readout and slider, shared with MobileFilterBar's price popover.
// The dragged position stays local and is committed on release, so a drag
// creates one URL update and history entry, not one per pointer move.
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

  // Reset the dragged position when the committed value changes from outside
  // (navigation or optimistic revert), during render rather than in an effect.
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
