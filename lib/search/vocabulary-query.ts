import { prisma } from "@/lib/prisma";
import type { SearchVocabulary } from "./interpretation";

// The uncached query behind the search vocabulary. The app reads it
// through getSearchVocabulary (lib/search/vocabulary.ts), which caches it;
// this raw version exists so the evaluation script can load the same
// vocabulary outside Next, where Next's cache isn't available.
//
// "Classes" is left out of the tags on purpose. Several tags in the browse
// URL mean "any of these", so "tennis class" mapped to Tennis + Classes
// would match every class of any sport. Class intent goes through the
// single-valued booking type instead (fixed_session) - the same reason the
// quick-filter chip row leaves "Classes" out (see lib/browse-tags.ts).
const EXCLUDED_TAG = "Classes";

export async function querySearchVocabulary(): Promise<SearchVocabulary> {
  const [tags, cities, activities] = await Promise.all([
    prisma.tag.findMany({
      where: { name: { not: EXCLUDED_TAG } },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
    prisma.city.findMany({
      where: { venues: { some: {} } },
      select: { name: true, region: true, country: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.activity.findMany({
      where: { listings: { some: { archivedAt: null } } },
      select: { name: true, tags: { select: { tag: { select: { name: true } } } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    tags: tags.map((t) => t.name),
    cities: cities.map((c) => ({
      name: c.name,
      label: [c.name, c.region, c.country.name].filter(Boolean).join(", "),
    })),
    activities: activities.map((a) => ({
      name: a.name,
      tags: a.tags.map((t) => t.tag.name).filter((name) => name !== EXCLUDED_TAG),
    })),
  };
}
