"use server";

import { z } from "zod";
import { interpretWithLlm } from "@/lib/llm";
import { keywordInterpret } from "@/lib/search/keyword";
import { interpretationToParams } from "@/lib/search/interpretation";
import { getSearchVocabulary } from "@/lib/search/vocabulary";

// A Server Action is a public endpoint, so its input is parsed like any
// other untrusted request. `today` is the viewer's own calendar date
// (browse resolves dates in the viewer's local time - see the "This
// weekend" pill), used to turn "this weekend" into real dates.
const searchInputSchema = z.object({
  query: z.string().trim().min(1).max(200),
  today: z.iso.date(),
});

// `query` is the browse page's query string (no leading "?"): the header
// search hands it to the shared browse navigation, which owns the push.
export type SearchResult = { ok: true; query: string } | { ok: false };

// Natural-language search: interpret the query into browse filters with
// the LLM, falling back to keyword matching if that fails for any reason,
// and return the browse query string. The search itself is done by the existing
// browse filters, so results always match what the sidebar would show for
// the same filters.
export async function searchAction(input: { query: string; today: string }): Promise<SearchResult> {
  const parsed = searchInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { query, today } = parsed.data;

  const vocabulary = await getSearchVocabulary();
  const interpretation = (await interpretWithLlm(query, vocabulary, today)) ?? keywordInterpret(query, vocabulary);

  return { ok: true, query: interpretationToParams(interpretation, query, today).toString() };
}
