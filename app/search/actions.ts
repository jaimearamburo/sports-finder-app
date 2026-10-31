"use server";

import { z } from "zod";
import { interpretWithLlm } from "@/lib/llm";
import { keywordInterpret } from "@/lib/search/keyword";
import { interpretationToParams } from "@/lib/search/interpretation";
import { getSearchVocabulary } from "@/lib/search/vocabulary";

// Parsed like any untrusted request. `today` is the viewer's calendar date
// (browse resolves dates locally), used to resolve "this weekend".
const searchInputSchema = z.object({
  query: z.string().trim().min(1).max(200),
  today: z.iso.date(),
});

// `query` is the browse query string (no "?"); the header search hands it to
// the shared browse navigation.
export type SearchResult = { ok: true; query: string } | { ok: false };

// Natural-language search: the LLM interprets the query into browse filters,
// with keyword matching as a fallback, and returns the browse query string.
// Results come from the browse filters, so they match the sidebar.
export async function searchAction(input: { query: string; today: string }): Promise<SearchResult> {
  const parsed = searchInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { query, today } = parsed.data;

  const vocabulary = await getSearchVocabulary();
  const interpretation = (await interpretWithLlm(query, vocabulary, today)) ?? keywordInterpret(query, vocabulary);

  return { ok: true, query: interpretationToParams(interpretation, query, today).toString() };
}
