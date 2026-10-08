import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

// Cache so tags don't get refetched on every request. Ordered by
// displayOrder, an editable column on Tag, with name as a tiebreaker so
// multiple tags left at the default order value fall back to a stable,
// readable alphabetical order instead of whatever arbitrary order
// Postgres returns for ties.
//
// "Classes" is excluded from this list on purpose, not deleted from the
// database - as it's redundant with the Classes category (see
// lib/category-filters.ts's mechanic-based CATEGORIES), so it no longer
// needs its own quick-filter chip, but the Tag row and its ActivityTag
// links stay intact (Tennis Class, Gym Class, etc. keep it) in case
// anything still filters on it directly.
export const getBrowseTags = unstable_cache(
  () =>
    prisma.tag.findMany({
      where: { name: { not: "Classes" } },
      select: { id: true, name: true, emoji: true, color: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
  ["browse-tags"],
  { revalidate: 3600, tags: ["browse-tags"] }
);
