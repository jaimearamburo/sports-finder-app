import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

// Quick-filter tags, cached, ordered by displayOrder then name. "Classes" is
// excluded because the Classes category covers it (lib/category-filters.ts);
// the tag stays in the database.
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
