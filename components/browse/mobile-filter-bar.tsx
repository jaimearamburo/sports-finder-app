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

// rounded-md (not rounded-full), matching QuickFiltersPanel's own pills
// exactly - the two rows sit one above the other, so a mismatched shape
// between them reads as an inconsistency rather than a deliberate style.
const PILL_CLASS =
  "h-9 shrink-0 rounded-md border bg-card px-3.5 text-sm font-medium text-muted-foreground hover:border-foreground/50 hover:text-foreground";
// A distinct active treatment from the quick-filter pills' solid black
// fill (see quick-filters-panel.tsx's PILL_ACTIVE_CLASS) - a purple
// border signals "filtering" here without competing for visual weight
// with that row's own active state, since both rows can be active at the
// same time.
const PILL_ACTIVE_CLASS = "border-2 border-violet-500 text-violet-600 dark:border-violet-400 dark:text-violet-400";

function formatPriceLabel(min: number, max: number): string {
  if (min === PRICE_MIN && max >= PRICE_MAX) return "Any price";
  const lower = min === PRICE_MIN ? "Free" : `$${min}`;
  const upper = max >= PRICE_MAX ? `$${PRICE_MAX}+` : `$${max}`;
  return `${lower} – ${upper}`;
}

// The mobile equivalent of BrowseSidebar's vertical column: the exact same
// filters (city, category, price), routed through the same
// useSidebarFilterRouting hook so both stay in sync with the URL, laid out
// as a horizontal pill row instead of a sidebar - order is city, then
// category, then price, matching how a browse app like UberEats orders its
// own top filter bar (location first, then category, then narrower
// refinements). Rendered unconditionally alongside BrowseSidebar (see
// BrowsePageShell) and shown/hidden with plain CSS breakpoints, not
// a JS viewport check, so there's no post-mount "wrong layout first" flash.
export function MobileFilterBar({ cities }: { cities: BrowseCityGroup[] }) {
  // Already includes a change that's still loading (see useBrowseFilters),
  // so a tap shows straight away.
  const { category, city, priceMin, priceMax, changeAction } = useSidebarFilterRouting();
  const current: SidebarFilterValues = { category, city, priceMin, priceMax };

  const isCityActive = current.city !== "";
  const isPriceActive = current.priceMin > PRICE_MIN || current.priceMax < PRICE_MAX;

  return (
    <ScrollArea
      className="-mt-2 -mr-2 -ml-2 mb-3"
      // Same trailing-edge mask-image hint TagFilterChips already uses -
      // see that file for why it has to live on the Viewport rather than
      // the scrolled content itself. No <ScrollBar> rendered here (unlike
      // TagFilterChips) - its own thumb track added a visible strip of
      // space between this row and the one below it, which read as a gap
      // where there shouldn't be one; the row is still touch/drag-
      // scrollable without it, it just has no visible scrollbar chrome.
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
          {/* w-60 overrides the shared SelectContent's own
              w-(--anchor-width) (see components/ui/select.tsx) - that
              default sizes the dropdown to match its trigger's own
              width, which is fine for the sidebar's full-width trigger
              but truncates longer city names against this compact pill
              trigger. */}
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
