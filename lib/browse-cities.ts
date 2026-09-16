import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

// Mirrors getBrowseTags: a small, infrequently-changing list cached across
// requests rather than queried on every page load.
export const getBrowseCities = unstable_cache(
  async () => {
    const venues = await prisma.venue.findMany({
      select: { city: true },
      distinct: ["city"],
      orderBy: { city: "asc" },
    });
    return venues.map((venue) => venue.city);
  },
  ["browse-cities"],
  { revalidate: 3600 }
);
