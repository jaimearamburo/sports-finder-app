import Link from "next/link";
import { Info, SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageListing } from "@/lib/authz/policies";
import { EAGER_CARD_COUNT, ListingGrid, getPrimaryTag, type ListingCardData } from "@/components/browse/listing-card";
import { isCategoryId, MECHANIC_CATEGORIES, type CategoryId } from "@/lib/category-filters";
import { PRICE_MIN, PRICE_MAX } from "@/lib/price-range";
import { getBookableDates, getSpotsRemaining, hasAvailableSlotOnDate } from "@/lib/availability";
import { browseParamsSchema } from "@/lib/validation/browse";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Raw browse URL params; ListingSection parses them. Shared with app/page.tsx.
export type BrowseSearchParams = {
  category?: string;
  tags?: string;
  city?: string;
  priceMin?: string;
  priceMax?: string;
  date?: string;
};

// The browse results, separate so app/page.tsx can wrap only the slow query in
// Suspense.
export async function ListingSection({ searchParams }: { searchParams: BrowseSearchParams }) {
  const {
    category: rawCategory,
    tags: rawTags,
    city: rawCity,
    priceMin: rawPriceMin,
    priceMax: rawPriceMax,
    date: rawDate,
  } = searchParams;

  const category: CategoryId = rawCategory && isCategoryId(rawCategory) ? rawCategory : "all";
  // Price, date and tag params are parsed and bounded by browseParamsSchema.
  // Dates are one day or the weekend pair, already resolved to calendar days on
  // the client.
  const {
    priceMin,
    priceMax,
    dates,
    tags: selectedTags,
    cities,
  } = browseParamsSchema.parse({
    priceMin: rawPriceMin,
    priceMax: rawPriceMax,
    dates: rawDate,
    tags: rawTags,
    cities: rawCity,
  });

  // Category is a BookingMechanic value, so it filters directly. Tags are a
  // separate condition; both go in an AND array so neither overwrites the
  // other.
  const activityConditions = [];
  if (category !== "all") activityConditions.push({ bookingMechanic: category });
  if (selectedTags.length > 0) {
    activityConditions.push({
      tags: { some: { tag: { name: { in: selectedTags, mode: "insensitive" as const } } } },
    });
  }

  // The session is only needed for edit shortcuts and is read in parallel with
  // the listings; a failure just means no shortcuts.
  const sessionPromise = auth().catch(() => null);
  const listings = await prisma.listing.findMany({
    where: {
      // Archived listings never show in browse.
      archivedAt: null,
      activity: activityConditions.length > 0 ? { AND: activityConditions } : undefined,
      // One or more cities (lib/city-filter.ts), matched as "any of".
      venue: cities.length > 0 ? { city: { name: { in: cities } } } : undefined,
      // PRICE_MAX is open-ended ("$100+"), so only the lower bound applies once
      // the range reaches it.
      pricePerUnit: {
        gte: priceMin > PRICE_MIN ? priceMin : undefined,
        lte: priceMax < PRICE_MAX ? priceMax : undefined,
      },
    },
    include: {
      activity: { include: { tags: { include: { tag: true } } } },
      venue: { include: { city: { include: { country: true } } } },
    },
    orderBy: { name: "asc" },
  });

  if (listings.length === 0) {
    return <NoResults />;
  }

  // A date filter keeps only listings bookable on at least one of `dates`, for
  // every mechanic. It costs a query or two per listing, so it only runs when a
  // date is chosen.
  let filteredListings: ListingCardData[] = listings;
  if (dates.length > 0) {
    type DateCheckResult = { id: string; ok: boolean; spotsLeft?: number | null };
    const results: DateCheckResult[] = await Promise.all(
      listings.map(async (listing): Promise<DateCheckResult> => {
        // getBookableDates covers the window, overrides and a class's weekday.
        const bookableDates = await getBookableDates(listing);
        const matchingDates = dates.filter((d) => bookableDates.some((bd) => bd.getTime() === d.getTime()));
        if (matchingDates.length === 0) return { id: listing.id, ok: false };

        const timeZone = listing.venue.city.timezone;

        if (listing.activity.bookingMechanic === "time_range") {
          // An open day isn't enough if every slot is booked. Stops at the
          // first date with a free slot.
          for (const d of matchingDates) {
            if (await hasAvailableSlotOnDate(listing, d, timeZone)) {
              return { id: listing.id, ok: true };
            }
          }
          return { id: listing.id, ok: false };
        }
        if (listing.activity.bookingMechanic === "fixed_session") {
          // A class occurs on one weekday, so matchingDates holds at most one
          // date.
          const spotsMap = await getSpotsRemaining(listing, matchingDates, timeZone);
          const spotsLeft = spotsMap.get(matchingDates[0].getTime()) ?? null;
          // A full class isn't bookable on this date.
          return { id: listing.id, ok: spotsLeft === null || spotsLeft > 0, spotsLeft };
        }
        // date_range: the day-level check is enough; per-day capacity isn't
        // checked here.
        return { id: listing.id, ok: true };
      })
    );
    const byId = new Map(results.map((r) => [r.id, r]));
    filteredListings = listings.flatMap((listing) => {
      const result = byId.get(listing.id);
      if (!result || !result.ok) return [];
      return [
        result.spotsLeft !== undefined ? { ...listing, dateFilterSpots: { spotsLeft: result.spotsLeft } } : listing,
      ];
    });
  }

  if (filteredListings.length === 0) {
    return <NoResults />;
  }

  // Which listings this visitor may edit, using the dashboard's ownership
  // policy against the venue already loaded with each listing (no extra
  // queries). Those cards get the edit gear.
  const session = await sessionPromise;
  const editableIds = new Set(
    filteredListings.filter((listing) => canManageListing(session?.user, listing)).map((listing) => listing.id)
  );

  // Grouped by booking mechanic first (the biggest difference in how
  // listings are booked), then by tag within each. MECHANIC_CATEGORIES sets
  // the section order; headings show even when only one mechanic remains.
  const byMechanic = new Map<string, ListingCardData[]>();
  for (const listing of filteredListings) {
    const mechanic = listing.activity.bookingMechanic;
    const bucket = byMechanic.get(mechanic);
    if (bucket) {
      bucket.push(listing);
    } else {
      byMechanic.set(mechanic, [listing]);
    }
  }
  const mechanicGroups = MECHANIC_CATEGORIES.filter((type) => byMechanic.has(type.id));

  return (
    <div className="mt-5 flex flex-col gap-10">
      {mechanicGroups.map((type) => (
        <section key={type.id}>
          {/* Full-width band: on phones a negative margin cancels the page
              gutter (with padding added back); md:mx-0 removes it once the
              sidebar is shown. */}
          <h2 className="-mx-4 mb-4 flex items-center border-primary bg-foreground/5 px-4 py-1 text-lg font-extralight sm:-mx-6 sm:px-6 md:mx-0 md:p-1 md:pl-2 md:rounded-sm">
            {type.label}
            <Popover>
              <PopoverTrigger
                aria-label={`What does "${type.label}" mean?`}
                className="ml-2 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
              >
                <Info className="size-3.5" />
              </PopoverTrigger>
              <PopoverContent className="w-64 text-sm font-normal" align="start">
                {type.description}
              </PopoverContent>
            </Popover>
          </h2>
          {/* Only the first grid on the page loads photos eagerly. */}
          <TagGroups
            listings={byMechanic.get(type.id)!}
            eager={type.id === mechanicGroups[0].id}
            editableIds={editableIds}
          />
        </section>
      ))}
    </div>
  );
}

// One h3 section per primary tag, ordered by Tag.displayOrder; untagged
// listings go last under "Other".
function TagGroups({
  listings,
  eager,
  editableIds,
}: {
  listings: ListingCardData[];
  eager: boolean;
  editableIds: ReadonlySet<string>;
}) {
  const groups = new Map<string, typeof listings>();
  const groupOrder = new Map<string, number>();
  for (const listing of listings) {
    const tag = getPrimaryTag(listing);
    const key = tag?.name ?? "Other";
    if (!groupOrder.has(key)) groupOrder.set(key, tag?.displayOrder ?? Infinity);
    const group = groups.get(key);
    if (group) {
      group.push(listing);
    } else {
      groups.set(key, [listing]);
    }
  }
  const groupNames = [...groups.keys()].sort(
    (a, b) => groupOrder.get(a)! - groupOrder.get(b)! || a.localeCompare(b)
  );

  return (
    <div className="flex flex-col gap-8">
      {groupNames.map((name, index) => (
        <section key={name}>
          <h3 className="mb-3 text-sm font-semibold">{name}</h3>
          <ListingGrid
            listings={groups.get(name)!}
            eagerCount={eager && index === 0 ? EAGER_CARD_COUNT : 0}
            editableIds={editableIds}
          />
        </section>
      ))}
    </div>
  );
}

// "Clear filters" links to bare browse: every filter lives in the query string.
function NoResults() {
  return (
    <div className="mt-16 flex flex-col items-center gap-3 text-center">
      <SearchX className="size-10 text-muted-foreground" />
      <p className="font-medium">No results match these filters</p>
      <p className="text-sm text-muted-foreground">Try a different date or city, or widen the price range.</p>
      <Link href="/" className={buttonVariants({ variant: "outline", className: "mt-2" })}>
        Clear filters
      </Link>
    </div>
  );
}
