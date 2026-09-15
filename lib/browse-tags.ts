import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

// Cache so tags don't get refetched on every request. Ordered by
// displayOrder, an editable column on Tag, with name as a tiebreaker so
// multiple tags left at the default order value fall back to a stable,
// readable alphabetical order instead of whatever arbitrary order
// Postgres returns for ties.
export const getBrowseTags = unstable_cache(
  () =>
    prisma.tag.findMany({
      select: { id: true, name: true, emoji: true, color: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
  ["browse-tags"],
  { revalidate: 3600 }
);
