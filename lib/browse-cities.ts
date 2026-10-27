import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export type BrowseCity = { name: string; label: string };
export type BrowseCityGroup = { countryName: string; countryCode: string; cities: BrowseCity[] };

// name is the real filter value (matches City.name, what the listings
// query actually filters on); label is just the display text. Kept apart
// rather than one formatted string doing both jobs - the sidebar's Select
// uses the same string for its value and its visible text, so a city with
// a region ("Blue Mountains, NSW") would otherwise become unmatchable
// against the plain "Blue Mountains" the query expects.
function formatCityLabel(city: { name: string; region: string | null }): BrowseCity {
  return { name: city.name, label: city.region ? `${city.name}, ${city.region}` : city.name };
}

// A small, infrequently-changing list cached across requests rather than
// queried on every page load. Only cities with at least one venue show up
// in the filter - City itself is a curated, platform-wide list (see
// schema.prisma). Grouped by country here, since the query already orders
// rows by country then city name, so the Map below only has to preserve
// that order, not re-sort it.
//
// Wrapped in both React's cache() and unstable_cache(). unstable_cache()
// persists the result across requests, so a later page load can skip the
// database entirely, but it does not dedupe calls that overlap within one
// request. This function is called from two separate Suspense branches on
// the browse page (the desktop sidebar and the mobile filter bar), which
// React can resolve concurrently, so on a cold or expired cache both
// could race in and each trigger a real query. cache() is the
// request-scoped memoization that prevents that: the first call runs for
// real, and every other call with the same arguments during that render
// reuses its result.
export const getBrowseCities = cache(
  unstable_cache(
    // Fetches every city that has at least one venue, grouped by country.
    async (): Promise<BrowseCityGroup[]> => {
      const cities = await prisma.city.findMany({
        where: { venues: { some: {} } },
        select: { name: true, region: true, country: { select: { name: true, code: true } } },
        orderBy: [{ country: { name: "asc" } }, { name: "asc" }],
      });

      const groups = new Map<string, BrowseCityGroup>();
      for (const city of cities) {
        const key = city.country.name;
        const group = groups.get(key);
        if (group) {
          group.cities.push(formatCityLabel(city));
        } else {
          groups.set(key, {
            countryName: city.country.name,
            countryCode: city.country.code,
            cities: [formatCityLabel(city)],
          });
        }
      }
      return [...groups.values()];
    },
    ["browse-cities"],
    { revalidate: 3600, tags: ["browse-cities"] }
  )
);
