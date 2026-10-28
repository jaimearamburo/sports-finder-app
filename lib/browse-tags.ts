import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

// Cached so tags don't get refetched on every request. Ordered by
// displayOrder, an editable column on Tag, with name as a tiebreaker so
// tags left at the default order value fall back to a stable, readable
// alphabetical order instead of whatever arbitrary order Postgres
// returns for ties.
//
// "Classes" is excluded from the quick-filter chip row because it
// duplicates the mechanic-based Classes category (see
// lib/category-filters.ts). The Tag row and its ActivityTag links stay
// intact in the database, so activities like Tennis Class and Gym Class
// still carry it.
export const getBrowseTags = unstable_cache(
  // Fetches every quick-filter tag except "Classes", for the chip row.
  () =>
    prisma.tag.findMany({
      where: { name: { not: "Classes" } },
      select: { id: true, name: true, emoji: true, color: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
  ["browse-tags"],
  { revalidate: 3600, tags: ["browse-tags"] }
);
