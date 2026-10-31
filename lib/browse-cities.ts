import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export type BrowseCity = { name: string; label: string };
export type BrowseCityGroup = { countryName: string; countryCode: string; cities: BrowseCity[] };

// `name` is the filter value (City.name); `label` is display text. Separate
// because the Select uses one string for value and text, and a label with a
// region wouldn't match the query.
function formatCityLabel(city: { name: string; region: string | null }): BrowseCity {
  return { name: city.name, label: city.region ? `${city.name}, ${city.region}` : city.name };
}

// Cities with at least one venue, grouped by country (the query's ordering is
// preserved). Cached across requests with unstable_cache; React's cache() also
// dedupes the two concurrent calls in one render (desktop sidebar and mobile
// filter bar), which unstable_cache doesn't.
export const getBrowseCities = cache(
  unstable_cache(
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
