import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

// Mirrors getBrowseTags: a small, infrequently-changing list cached across
// requests rather than queried on every page load. Only cities with at
// least one venue show up in the filter - City itself is a curated,
// platform-wide list (see schema.prisma).
export const getBrowseCities = unstable_cache(
  async () => {
    const cities = await prisma.city.findMany({
      where: { venues: { some: {} } },
      select: { name: true },
      orderBy: { name: "asc" },
    });
    return cities.map((city) => city.name);
  },
  ["browse-cities"],
  { revalidate: 3600, tags: ["browse-cities"] }
);
