import "server-only";
import { unstable_cache } from "next/cache";
import { querySearchVocabulary } from "./vocabulary-query";

// The search vocabulary, cached like the browse tag and city lists (shared
// cache tags), so a search doesn't query the database. Refreshes hourly or via
// app/dev/revalidate-browse.
export const getSearchVocabulary = unstable_cache(querySearchVocabulary, ["search-vocabulary"], {
  revalidate: 3600,
  tags: ["browse-tags", "browse-cities"],
});
