"use client";

import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/lib/category-filters";
import { PRICE_MIN, PRICE_MAX } from "@/lib/price-range";
import { useSidebarFilterRouting } from "@/components/browse/browse-sidebar";
import { PriceRangeSlider, type SidebarFilterValues } from "@/components/browse/browse-sidebar-panel";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { BrowseCityGroup } from "@/lib/browse-cities";
import { citySelectValue, MULTIPLE_CITIES_LABEL, MULTIPLE_CITIES_VALUE } from "@/lib/city-filter";

// rounded-md to match QuickFiltersPanel's pills in the row above.
const PILL_CLASS =
  "h-9 shrink-0 rounded-md border bg-card px-3.5 text-sm font-medium text-muted-foreground hover:border-foreground/50 hover:text-foreground";
// Violet border for an active filter, distinct from the quick filters' solid
// black, since both rows can be active.
const PILL_ACTIVE_CLASS = "border-2 border-violet-500 text-violet-600 dark:border-violet-400 dark:text-violet-400";

function formatPriceLabel(min: number, max: number): string {
  if (min === PRICE_MIN && max >= PRICE_MAX) return "Any price";
  const lower = min === PRICE_MIN ? "Free" : `$${min}`;
  const upper = max >= PRICE_MAX ? `$${PRICE_MAX}+` : `$${max}`;
  return `${lower} – ${upper}`;
}

// The phone version of BrowseSidebar: city, category and price as a pill row,
// using the same useSidebarFilterRouting. Rendered alongside BrowseSidebar and
// shown by breakpoint classes (see BrowsePageShell).
export function MobileFilterBar({ cities }: { cities: BrowseCityGroup[] }) {
  // Includes a change still loading (useBrowseFilters), so taps show
  // immediately.
  const { category, city, priceMin, priceMax, changeAction } = useSidebarFilterRouting();
  const current: SidebarFilterValues = { category, city, priceMin, priceMax };

  const isCityActive = current.city !== "";
  const isPriceActive = current.priceMin > PRICE_MIN || current.priceMax < PRICE_MAX;

  return (
    <ScrollArea
      className="-mt-2 -mr-2 -ml-2 mb-3"
      // Same edge-fade hint as TagFilterChips. No ScrollBar: its track added a
      // visible gap below the row.
      viewportClassName="mask-[linear-gradient(to_right,black_calc(100%-56px),transparent_100%)]"
    >
      <div className="flex gap-1.5 px-2 py-1">
        <Select
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
          <SelectTrigger className={cn(PILL_CLASS, isCityActive && PILL_ACTIVE_CLASS)} aria-label="City">
            <SelectValue />
          </SelectTrigger>
          {/* w-60 overrides SelectContent's trigger-width default, which
              truncates city names under this narrow pill. */}
          <SelectContent className="w-60">
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

        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => changeAction({ ...current, category: cat.id })}
            aria-pressed={current.category === cat.id}
            className={cn(PILL_CLASS, current.category === cat.id && PILL_ACTIVE_CLASS)}
          >
            {cat.label}
          </button>
        ))}

        <Popover>
          <PopoverTrigger aria-pressed={isPriceActive} className={cn(PILL_CLASS, isPriceActive && PILL_ACTIVE_CLASS)}>
            {formatPriceLabel(current.priceMin, current.priceMax)}
          </PopoverTrigger>
          <PopoverContent className="w-64" align="start">
            <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Price range
            </h2>
            <PriceRangeSlider
              priceMin={current.priceMin}
              priceMax={current.priceMax}
              onCommit={(min, max) => changeAction({ ...current, priceMin: min, priceMax: max })}
            />
          </PopoverContent>
        </Popover>
      </div>
    </ScrollArea>
  );
}
