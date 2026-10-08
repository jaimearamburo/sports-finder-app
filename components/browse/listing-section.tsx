import { prisma } from "@/lib/prisma";
import { ListingGrid, ListingCard, getPrimaryTag, type ListingCardData } from "@/components/browse/listing-card";
import { HorizontalScrollRow } from "@/components/browse/horizontal-scroll-row";
import { isCategoryId, MECHANIC_CATEGORIES, type CategoryId } from "@/lib/category-filters";
import { PRICE_MIN, PRICE_MAX } from "@/lib/price-range";
import { getBookableDates, getSpotsRemaining, hasAvailableSlotOnDate } from "@/lib/availability";
import { startOfUTCDay } from "@/lib/dates";

// All URL search params ListingSection's query can filter on. Every
// value is a raw string (or absent) since it comes straight off the URL;
// parsing and validation happen inside ListingSection itself. Shared with
// app/page.tsx so the two stay in sync as filters are added, rather than
// each redeclaring the same shape.
export type BrowseSearchParams = {
  category?: string;
  tags?: string;
  city?: string;
  priceMin?: string;
  priceMax?: string;
  date?: string;
};

// The slow part of the browse page, isolated into its own component so
// app/page.tsx can wrap only this in Suspense. The sidebar and chip row
// render immediately regardless of how long this query takes.
export async function ListingSection({ searchParams }: { searchParams: BrowseSearchParams }) {
  const {
    category: rawCategory,
    tags: rawTags,
    city,
    priceMin: rawPriceMin,
    priceMax: rawPriceMax,
    date: rawDate,
  } = searchParams;

  const category: CategoryId = rawCategory && isCategoryId(rawCategory) ? rawCategory : "all";
  const selectedTags = rawTags ? rawTags.split(",").filter(Boolean) : [];
  const priceMin = rawPriceMin ? Number(rawPriceMin) : PRICE_MIN;
  const priceMax = rawPriceMax ? Number(rawPriceMax) : PRICE_MAX;
  // One date (a specific day picked from the calendar) or two (the "This
  // weekend" pill's Saturday+Sunday) - resolved to concrete calendar days
  // entirely client-side (see components/browse/date-filter-popover.tsx and
  // quick-filters-panel.tsx), so this never needs to know which pill
  // produced them or whose timezone defined "today". Each is normalized to
  // UTC midnight so it compares equal to the Date objects
  // getBookableDates/getSpotsRemaining already produce and key by.
  const dates = rawDate
    ? rawDate.split(",").map((d) => startOfUTCDay(new Date(`${d}T00:00:00.000Z`)))
    : [];

  const hasActiveFilters =
    category !== "all" ||
    selectedTags.length > 0 ||
    !!city ||
    priceMin > PRICE_MIN ||
    priceMax < PRICE_MAX ||
    dates.length > 0;

  // Category is the booking-mechanic axis (see lib/category-filters.ts) —
  // its id is the literal BookingMechanic value itself, so it needs no
  // lookup table, just a direct field condition. Tags are a separate,
  // freely-combinable condition (AND'd with category, not merged into it):
  // both go into an AND array rather than being spread into one flat
  // object, since two spreads that both set a key on Activity would let
  // the second silently overwrite the first.
  const activityConditions = [];
  if (category !== "all") activityConditions.push({ bookingMechanic: category });
  if (selectedTags.length > 0) {
    activityConditions.push({
      tags: { some: { tag: { name: { in: selectedTags, mode: "insensitive" as const } } } },
    });
  }

  const listings = await prisma.listing.findMany({
    where: {
      // Retired listings (see Listing.archivedAt) are kept for their
      // booking history but should never show up as bookable again.
      archivedAt: null,
      activity: activityConditions.length > 0 ? { AND: activityConditions } : undefined,
      venue: city ? { city: { name: city } } : undefined,
      // PRICE_MAX is an open-ended "$100+" bound, so only the lower end
      // is enforced once the range reaches it.
      pricePerUnit: {
        gte: priceMin > PRICE_MIN ? priceMin : undefined,
        lte: priceMax < PRICE_MAX ? priceMax : undefined,
      },
    },
    include: {
      activity: { include: { tags: { include: { tag: true } } } },
      venue: { include: { city: true } },
    },
    orderBy: { name: "asc" },
  });

  if (listings.length === 0) {
    return <p className="mt-10 text-sm text-muted-foreground">No results match these filters.</p>;
  }

  // A date filter narrows results to listings actually bookable on at
  // least one of `dates`, across every mechanic - not just an annotation
  // on fixed_session cards. Deliberately opt-in: this runs one (sometimes
  // two) queries per listing, same shape as the per-listing checks the
  // detail page already makes, but only when the user has explicitly
  // picked a date (or "This weekend") rather than on every default page
  // load, which is what made the browse page slow before this was gated.
  let filteredListings: ListingCardData[] = listings;
  if (dates.length > 0) {
    type DateCheckResult = { id: string; ok: boolean; spotsLeft?: number | null };
    const results: DateCheckResult[] = await Promise.all(
      listings.map(async (listing): Promise<DateCheckResult> => {
        // getBookableDates already answers "is this day open at all" for
        // every mechanic (window, overrides, and - for fixed_session - the
        // recurrence weekday) - reused as-is rather than re-deriving any
        // of that here.
        const bookableDates = await getBookableDates(listing);
        const matchingDates = dates.filter((d) => bookableDates.some((bd) => bd.getTime() === d.getTime()));
        if (matchingDates.length === 0) return { id: listing.id, ok: false };

        const timeZone = listing.venue.city.timezone;

        if (listing.activity.bookingMechanic === "time_range") {
          // Being an "open" day isn't enough on its own - every increment
          // could already be booked out. Checked per matching date,
          // stopping at the first one that clears - a single-date filter
          // still costs exactly one check, "This weekend" at most two.
          for (const d of matchingDates) {
            if (await hasAvailableSlotOnDate(listing, d, timeZone)) {
              return { id: listing.id, ok: true };
            }
          }
          return { id: listing.id, ok: false };
        }
        if (listing.activity.bookingMechanic === "fixed_session") {
          // A fixed_session listing recurs on exactly one weekday (enforced
          // by getBookableDates itself), so matchingDates can only ever
          // hold zero or one entry here regardless of how many candidate
          // dates were passed in - no ambiguity about which date's
          // spots-left to show.
          const spotsMap = await getSpotsRemaining(listing, matchingDates, timeZone);
          const spotsLeft = spotsMap.get(matchingDates[0].getTime()) ?? null;
          // A class that's full on this date isn't actually bookable this
          // date either - same "only show what's bookable" rule
          // time_range already gets via hasAvailableSlotOnDate above, not
          // just an annotation on an otherwise-still-shown card.
          return { id: listing.id, ok: spotsLeft === null || spotsLeft > 0, spotsLeft };
        }
        // date_range: the day-level check above is the whole story here -
        // not additionally checking per-day capacity exhaustion for stays.
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
    return <p className="mt-10 text-sm text-muted-foreground">No results match these filters.</p>;
  }

  // Top-level grouping is by booking mechanic rather than tag: it's the
  // bigger structural difference between listings (a court you book by
  // time range books completely differently from a class you book into a
  // fixed session), so it makes a better first cut than the cross-cutting
  // tag grouping used within each mechanic below. MECHANIC_CATEGORIES
  // fixes the section order; a mechanic with no results in this query
  // just doesn't get a section of its own. The heading always renders,
  // even when only one mechanic is present (e.g. the sidebar's category
  // filter narrows to a single one) - a long single-mechanic result list
  // still needs a visible label once it's long enough to scroll past
  // whatever filter the user picked to get there.
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
    <div className="mt-6 flex flex-col gap-10">
      {mechanicGroups.map((type) => (
        <section key={type.id}>
          {/* Painted full-width (the section's own width, since `main` in
              app/page.tsx carries no independent horizontal padding of its
              own) */}
          <h2 className="mb-4 border-primary bg-foreground/5 p-1 pl-2 text-lg font-semibold">
            {type.label}
          </h2>
          <TagGroups listings={byMechanic.get(type.id)!} carousel={!hasActiveFilters} />
        </section>
      ))}
    </div>
  );
}

// Groups a set of listings by primary tag, one h3-headed section per tag.
// Section order comes from each tag's own displayOrder column, fetched
// alongside the listing's activity.tags.tag relation. Listings with no
// tag sort last under "Other". carousel caps each group to a horizontal,
// arrow-advanced row (see HorizontalScrollRow) on the default, unfiltered
// landing view, so first load isn't an endless vertical scroll regardless
// of how many listings a tag has - any active filter switches back to the
// plain full vertical grid, since results are already narrowed by then.
function TagGroups({ listings, carousel }: { listings: ListingCardData[]; carousel: boolean }) {
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
      {groupNames.map((name) => (
        <section key={name}>
          <h3 className="mb-3 text-sm font-semibold">{name}</h3>
          {carousel ? (
            <HorizontalScrollRow>
              {groups.get(name)!.map((listing) => (
                <div key={listing.id} className="w-55 shrink-0">
                  <ListingCard listing={listing} />
                </div>
              ))}
            </HorizontalScrollRow>
          ) : (
            <ListingGrid listings={groups.get(name)!} />
          )}
        </section>
      ))}
    </div>
  );
}
