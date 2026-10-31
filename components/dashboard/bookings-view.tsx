"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { SegmentedControl } from "@/components/dashboard/form-controls";
import { cn } from "@/lib/utils";
import type { FilterVenueOption } from "@/lib/dashboard/bookings";
import { bookingFiltersQuery, type BookingFilters, type BookingsWhen } from "@/lib/validation/manager-bookings";

const ALL = "__all__";
const WHEN_LABELS: { value: BookingsWhen; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "all", label: "All" },
];

// The bookings page's filter bar and its server-rendered results (children).
// Filters live in the URL, so views survive refresh and can be linked; changes
// navigate in a transition and the old results stay faded until the new ones
// arrive.
export function BookingsView({
  filters,
  venues,
  children,
}: {
  filters: BookingFilters;
  venues: FilterVenueOption[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(filters.q ?? "");

  // Keep the search box in sync when the URL changes elsewhere (back button,
  // Clear filters), during render.
  const [shownQ, setShownQ] = useState(filters.q);
  if (shownQ !== filters.q) {
    setShownQ(filters.q);
    setSearch(filters.q ?? "");
  }

  // Any change to what's shown goes back to the first page.
  function apply(changes: Partial<BookingFilters>) {
    const query = bookingFiltersQuery(filters, { ...changes, page: 1 });
    startTransition(() => router.push(query ? `/dashboard/bookings?${query}` : "/dashboard/bookings"));
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    apply({ q: search.trim() || undefined });
  }

  const selectedVenue = venues.find((venue) => venue.id === filters.venue);
  // Listings to choose from: the chosen venue's, or every venue's, grouped.
  const listingGroups = selectedVenue ? [selectedVenue] : venues;
  const listingLabel = (listing: { name: string; archived: boolean }) =>
    listing.archived ? `${listing.name} (archived)` : listing.name;
  const filtered = Boolean(filters.venue || filters.listing || filters.from || filters.to || filters.q || filters.when !== "upcoming");

  return (
    <div>
      <div className="mb-5 flex flex-col gap-4 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <div className="flex flex-col gap-1.5">
            <span id="when-label" className="text-sm leading-none font-medium">
              Show
            </span>
            <SegmentedControl
              labelledBy="when-label"
              options={WHEN_LABELS}
              value={filters.when}
              onChange={(when) => apply({ when })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-venue">Venue</Label>
            <Select
              items={[{ label: "All venues", value: ALL }, ...venues.map((venue) => ({ label: venue.name, value: venue.id }))]}
              value={filters.venue ?? ALL}
              // A different venue clears the listing, which may not belong to it.
              onValueChange={(value) => apply({ venue: value === ALL ? undefined : String(value), listing: undefined })}
            >
              <SelectTrigger id="filter-venue" className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All venues</SelectItem>
                <SelectSeparator />
                {venues.map((venue) => (
                  <SelectItem key={venue.id} value={venue.id}>
                    {venue.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-listing">Listing</Label>
            <Select
              items={[
                { label: "All listings", value: ALL },
                ...listingGroups.flatMap((venue) => venue.listings.map((listing) => ({ label: listingLabel(listing), value: listing.id }))),
              ]}
              value={filters.listing ?? ALL}
              onValueChange={(value) => apply({ listing: value === ALL ? undefined : String(value) })}
            >
              <SelectTrigger id="filter-listing" className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All listings</SelectItem>
                <SelectSeparator />
                {listingGroups.map((venue) => (
                  <SelectGroup key={venue.id}>
                    {!selectedVenue && <SelectLabel className="bg-muted">{venue.name}</SelectLabel>}
                    {venue.listings.map((listing) => (
                      <SelectItem key={listing.id} value={listing.id}>
                        {listingLabel(listing)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Second row: the date range kept together, then search taking the
            rest of the width. */}
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-from">From</Label>
            <Input
              id="filter-from"
              type="date"
              value={filters.from ?? ""}
              max={filters.to}
              onChange={(e) => apply({ from: e.target.value || undefined })}
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-to">To</Label>
            <Input
              id="filter-to"
              type="date"
              value={filters.to ?? ""}
              min={filters.from}
              onChange={(e) => apply({ to: e.target.value || undefined })}
              className="w-40"
            />
          </div>
          <form role="search" aria-label="Search bookings" onSubmit={handleSearch} className="relative w-full min-w-56 flex-1 sm:max-w-md">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Search bookings"
              placeholder="Search by reference, name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              enterKeyHint="search"
              maxLength={100}
              className="pl-8 [&::-webkit-search-cancel-button]:appearance-none"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setSearch("");
                  if (filters.q) apply({ q: undefined });
                }}
                className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X aria-hidden className="size-4" />
              </button>
            )}
          </form>
          {filtered && (
            <button
              type="button"
              onClick={() => startTransition(() => router.push("/dashboard/bookings"))}
              className="inline-flex h-9 items-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div aria-busy={isPending} className={cn("transition-opacity duration-200", isPending && "opacity-40")}>
        {children}
      </div>
    </div>
  );
}
