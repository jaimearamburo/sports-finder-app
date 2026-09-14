import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

// Cache so tags don't get refetched on every request.
export const getBrowseTags = unstable_cache(
  () => prisma.tag.findMany({ select: { id: true, name: true } }),
  ["browse-tags"],
  { revalidate: 3600 }
);
