import { EMPTY_INTERPRETATION, type Interpretation, type SearchVocabulary, type When } from "./interpretation";

// The fallback interpreter when the LLM fails, times out or refuses. Whole-word
// matches on real tag, activity and city names, plus fixed phrases for dates
// and price. No typo or synonym handling.

function containsPhrase(text: string, phrase: string): boolean {
  const escaped = phrase.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`).test(text);
}

const WHEN_PHRASES: [string, When][] = [
  ["next weekend", "next_weekend"],
  ["this weekend", "this_weekend"],
  ["weekend", "this_weekend"],
  ["tomorrow", "tomorrow"],
  ["today", "today"],
  ["tonight", "today"],
  ["monday", "monday"],
  ["tuesday", "tuesday"],
  ["wednesday", "wednesday"],
  ["thursday", "thursday"],
  ["friday", "friday"],
  ["saturday", "saturday"],
  ["sunday", "sunday"],
];

export function keywordInterpret(query: string, vocabulary: SearchVocabulary): Interpretation {
  const text = query.toLowerCase();

  const directTags = vocabulary.tags.filter((tag) => containsPhrase(text, tag));
  const tags = new Set(directTags);
  // An activity name adds its tags only when none was named directly: several
  // tags mean "any of", so "yoga class" would otherwise widen to every fitness
  // listing.
  for (const activity of vocabulary.activities) {
    if (!containsPhrase(text, activity.name)) continue;
    if (activity.tags.some((tag) => directTags.includes(tag))) continue;
    activity.tags.forEach((tag) => tags.add(tag));
  }

  const cities = vocabulary.cities.filter((city) => containsPhrase(text, city.name)).map((city) => city.name);
  const when = WHEN_PHRASES.find(([phrase]) => containsPhrase(text, phrase))?.[1] ?? "none";

  return {
    ...EMPTY_INTERPRETATION,
    tags: [...tags],
    cities,
    when,
    priceMax: containsPhrase(text, "free") ? 0 : null,
  };
}
