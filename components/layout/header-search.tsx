"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchAction } from "@/app/search/actions";
import { clearAllParams } from "@/components/browse/search-interpretation";
import { useBrowseFilters, useBrowseNavigation } from "@/contexts/browse-navigation";

// Lets other controls focus the search box (e.g. browse's floating search
// button).
export const SITE_SEARCH_ID = "site-search";

// Rotating example queries showing the box takes plain language. Each uses an
// activity and city that exist in the data.
const EXAMPLES = [
  "tennis in Sydney this weekend",
  "yoga class on Saturday morning",
  "camping in the Blue Mountains",
  "padel court in Sydney tomorrow",
  "gym day pass in Manhattan",
];

const ROTATE_MS = 3500;

// The viewer's calendar day as yyyy-mm-dd; browse resolves dates in local time.
function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// Shared with the Suspense fallback so the header doesn't shift.
const WRAPPER_CLASS = "relative w-full max-w-160 min-w-0";
const ICON_CLASS = "pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2";
// Typed text stays 16px on phones (iOS zooms smaller inputs on focus); only the
// placeholder is 14px so examples fit, ending in "…". pr-10 leaves room for the
// clear button. The last class hides the browser's own clear "x", which only
// emptied the box; ClearButton replaces it everywhere.
const INPUT_CLASS =
  "h-11 rounded-xl bg-muted/40 pr-10 pl-10 text-ellipsis placeholder:text-sm [&::-webkit-search-cancel-button]:appearance-none";

const GRADIENT_ID = "ai-sparkles-gradient";

// Two sharp four-point stars (lucide's sparkles have rounded tips), filled with
// an indigo-purple-pink gradient. The gradient uses userSpaceOnUse on the
// shared 24x24 grid, so it spans both stars and the spinner's arc as one.
//
// While a search runs the sparkles become a spinner in the same gradient. It
// still spins (slower) with reduced motion, since it's the only sign the search
// is working.
function SharpSparkles({ className }: { className: string }) {
  const star = (cx: number, cy: number, r: number, bow: number) =>
    `M${cx} ${cy - r}` +
    `Q${cx + bow} ${cy - bow} ${cx + r} ${cy}` +
    `Q${cx + bow} ${cy + bow} ${cx} ${cy + r}` +
    `Q${cx - bow} ${cy + bow} ${cx - r} ${cy}` +
    `Q${cx - bow} ${cy - bow} ${cx} ${cy - r}Z`;
  return (
    <svg viewBox="0 0 24 24" fill={`url(#${GRADIENT_ID})`} className={className} aria-hidden>
      <path d={star(10, 13, 10, 1.6)} />
      <path d={star(19.5, 4.5, 4, 0.7)} />
    </svg>
  );
}

function AiSparkles({ loading = false }: { loading?: boolean }) {
  return (
    <>
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <linearGradient id={GRADIENT_ID} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="24">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="50%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
      </svg>
      {loading ? (
        <Loader2
          stroke={`url(#${GRADIENT_ID})`}
          className={`${ICON_CLASS} animate-spin motion-reduce:[animation-duration:2s]`}
          aria-hidden
        />
      ) : (
        <SharpSparkles className={ICON_CLASS} />
      )}
    </>
  );
}

export function HeaderSearch() {
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const { markPending, pushBrowse } = useBrowseNavigation();
  const { update } = useBrowseFilters();
  // The current search lives in the URL as `q` (see searchAction), so a
  // refresh, back button or shared link keeps showing it in the box.
  const q = searchParams.get("q") ?? "";
  const [text, setText] = useState(q);
  const [index, setIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Resync the box when the URL query changes (new search, clear,
  // back/forward), during render rather than in an effect.
  const [prevQ, setPrevQ] = useState(q);
  if (q !== prevQ) {
    setPrevQ(q);
    setText(q);
  }

  // Paused while focused, so the hint doesn't change under someone reading or
  // typing.
  useEffect(() => {
    if (focused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % EXAMPLES.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [focused]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const query = text.trim();
    // One search at a time: Enter is ignored while one runs. Server Actions run
    // sequentially, so repeated presses would queue paid AI calls and repeat
    // the navigation.
    if (!query || isPending) return;
    startTransition(async () => {
      // Dims the browse results for the whole search, including the AI's
      // interpretation time.
      markPending();
      const result = await searchAction({ query, today: localToday() });
      // Updates after an await are outside the transition, so the navigation is
      // wrapped again; it joins this search's transition and keeps the spinner
      // up until results arrive.
      if (result.ok) startTransition(() => pushBrowse(result.query));
    });
  }

  // Empties the box and, if a search is showing, clears it too (like "Clear
  // search"). Elsewhere, e.g. a listing page, it only empties the box.
  function handleClear() {
    setText("");
    inputRef.current?.focus();
    if (q) update(clearAllParams);
  }

  return (
    // max-w-160 (640px) keeps the box its usual width in the header's flexible
    // column.
    <form role="search" aria-label="Search activities" onSubmit={handleSubmit} className={WRAPPER_CLASS}>
      {/* A spinner while searching; aria-busy on the input tells screen
          readers. */}
      <AiSparkles loading={isPending} />
      {/* Named by aria-label: the placeholder changes every few seconds. */}
      <Input
        ref={inputRef}
        id={SITE_SEARCH_ID}
        type="search"
        name="q"
        aria-label="Search"
        aria-busy={isPending}
        enterKeyHint="search"
        maxLength={200}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`“${EXAMPLES[index]}”`}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={INPUT_CLASS}
      />
      {/* Hidden while searching: the incoming results would undo a clear. */}
      {text !== "" && !isPending && <ClearButton onClick={handleClear} />}
    </form>
  );
}

// type="button" so it never submits. A 24px circle meets the minimum target
// size.
function ClearButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Clear search"
      className="absolute top-1/2 right-2.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <X className="size-4" aria-hidden />
    </button>
  );
}

// Shown while HeaderSearch waits on useSearchParams: the same box, not yet
// interactive.
export function HeaderSearchFallback() {
  return (
    <div className={WRAPPER_CLASS}>
      <AiSparkles />
      <Input type="search" aria-label="Search" disabled placeholder={`“${EXAMPLES[0]}”`} className={INPUT_CLASS} />
    </div>
  );
}
