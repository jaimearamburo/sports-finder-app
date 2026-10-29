import "server-only";
import { unstable_cache } from "next/cache";
import { querySearchVocabulary } from "./vocabulary-query";

// The search vocabulary (tags, cities, activities), cached across requests
// the same way the browse page caches its tag and city lists - so a search
// doesn't hit the database to build the model's schema. Shares their cache
// tags, so the dev "revalidate browse" tool (app/dev/revalidate-browse)
// refreshes this too after a reseed; otherwise it refreshes hourly.
export const getSearchVocabulary = unstable_cache(querySearchVocabulary, ["search-vocabulary"], {
  revalidate: 3600,
  tags: ["browse-tags", "browse-cities"],
});
