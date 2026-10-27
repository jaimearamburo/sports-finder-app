"use client";

import { startTransition, useOptimistic } from "react";
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
  const { category, city, priceMin, priceMax, changeAction } = useSidebarFilterRouting();
  const [optimistic, setOptimistic] = useOptimistic<SidebarFilterValues>({ category, city, priceMin, priceMax });
  const [isPending, setIsPending] = useOptimistic(false);

  function commitFilters(next: SidebarFilterValues) {
    startTransition(() => {
      setOptimistic(next);
      setIsPending(true);
      changeAction(next);
    });
  }

  const isCityActive = optimistic.city !== "";
  const isPriceActive = optimistic.priceMin > PRICE_MIN || optimistic.priceMax < PRICE_MAX;

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
      <div className="flex gap-1.5 px-2 py-1" data-pending={isPending ? "" : undefined}>
        <Select
          items={[
            { label: "All cities", value: "all" },
            ...cities.flatMap((group) => group.cities.map((c) => ({ label: c.label, value: c.name }))),
          ]}
          value={optimistic.city === "" ? "all" : optimistic.city}
          onValueChange={(value) =>
            commitFilters({ ...optimistic, city: !value || value === "all" ? "" : value })
          }
        >
          <SelectTrigger className={cn(PILL_CLASS, isCityActive && PILL_ACTIVE_CLASS)}>
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
            onClick={() => commitFilters({ ...optimistic, category: cat.id })}
            aria-pressed={optimistic.category === cat.id}
            className={cn(PILL_CLASS, optimistic.category === cat.id && PILL_ACTIVE_CLASS)}
          >
            {cat.label}
          </button>
        ))}

        <Popover>
          <PopoverTrigger aria-pressed={isPriceActive} className={cn(PILL_CLASS, isPriceActive && PILL_ACTIVE_CLASS)}>
            {formatPriceLabel(optimistic.priceMin, optimistic.priceMax)}
          </PopoverTrigger>
          <PopoverContent className="w-64" align="start">
            <h3 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Price range
            </h3>
            <PriceRangeSlider
              priceMin={optimistic.priceMin}
              priceMax={optimistic.priceMax}
              onCommit={(min, max) => commitFilters({ ...optimistic, priceMin: min, priceMax: max })}
            />
          </PopoverContent>
        </Popover>
      </div>
    </ScrollArea>
  );
}
