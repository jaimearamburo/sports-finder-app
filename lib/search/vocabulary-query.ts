import { prisma } from "@/lib/prisma";
import type { SearchVocabulary } from "./interpretation";

// The uncached vocabulary query; the app reads it through getSearchVocabulary
// (cached), and the eval script calls it directly outside Next.
//
// "Classes" is excluded from the tags: several tags mean "any of", so "tennis
// class" as Tennis + Classes would match every class. Class intent goes through
// the booking type (fixed_session) instead.
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
