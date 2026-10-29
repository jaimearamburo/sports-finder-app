"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchAction } from "@/app/search/actions";

// Example queries shown in rotation, to signal that the search box takes
// plain language rather than exact names. Each uses an activity and city
// that actually exist in the data.
const EXAMPLES = [
  "tennis in Sydney this weekend",
  "yoga class on Saturday morning",
  "camping in the Blue Mountains",
  "padel court in Sydney tomorrow",
  "gym day pass in Manhattan",
];

const ROTATE_MS = 3500;

// The viewer's own calendar day as yyyy-mm-dd - browse resolves dates in
// local time (see the "This weekend" pill), so search does too.
function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// Shared by the real search box and its Suspense fallback, so the header
// doesn't shift when the real one takes over.
const WRAPPER_CLASS = "relative w-full max-w-160 min-w-0";
const ICON_CLASS = "pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2";
// Typed text keeps the shared Input's 16px on phones - iPhone Safari zooms
// the page in on focus for anything smaller - and only the placeholder is
// 14px, so more of each example fits; text-ellipsis ends anything that
// still doesn't fit in "…".
const INPUT_CLASS = "h-11 rounded-xl bg-muted/40 pl-10 text-ellipsis placeholder:text-sm";

const GRADIENT_ID = "ai-sparkles-gradient";

// The sparkles icon (the common "AI" signal) drawn with an indigo-purple-pink
// gradient instead of one flat colour. Lucide icons are single-colour line
// drawings, so the gradient is a separate SVG definition the icon's stroke
// points at. userSpaceOnUse (the icon's own 24x24 grid), not the default
// per-shape bounding box: the icon's small "+" is made of straight lines,
// whose zero-width bounding box would make a per-shape gradient vanish.
// While a search runs, the sparkles swap for a spinner in the same gradient:
// a pulse was too subtle to notice in a ~1s search, while a spinner shows
// motion immediately. It keeps spinning, more slowly, for reduced-motion
// users: it's the only sign the search is working, not decoration, and with
// "reduce motion" on (e.g. Windows' "Animation effects" off) a still icon
// gave no feedback at all.
function AiSparkles({ loading = false }: { loading?: boolean }) {
  const Icon = loading ? Loader2 : Sparkles;
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
      <Icon
        stroke={`url(#${GRADIENT_ID})`}
        className={`${ICON_CLASS} ${loading ? "animate-spin motion-reduce:[animation-duration:2s]" : ""}`}
        aria-hidden
      />
    </>
  );
}

export function HeaderSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // The current search lives in the URL as `q` (see searchAction), so a
  // refresh, back button or shared link keeps showing it in the box.
  const q = searchParams.get("q") ?? "";
  const [text, setText] = useState(q);
  const [index, setIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Resync the box when the URL's query changes (a new search, "Clear
  // search", or browser back/forward) - React's "adjust state during
  // render" pattern rather than an effect.
  const [prevQ, setPrevQ] = useState(q);
  if (q !== prevQ) {
    setPrevQ(q);
    setText(q);
  }

  // Paused while the box is focused, so the hint doesn't change under
  // someone who has just clicked in to read or type.
  useEffect(() => {
    if (focused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % EXAMPLES.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [focused]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const query = text.trim();
    if (!query) return;
    startTransition(async () => {
      const result = await searchAction({ query, today: localToday() });
      if (result.ok) router.push(result.url);
    });
  }

  return (
    // max-w-160 (640px): from md up the header gives the search a flexible
    // column, so the cap moves here to keep the box its usual width.
    <form role="search" onSubmit={handleSubmit} className={WRAPPER_CLASS}>
      {/* The icon becomes a spinner while a search runs; aria-busy on the input
          carries the same state for screen readers. */}
      <AiSparkles loading={isPending} />
      {/* aria-label, not the placeholder, names the field: a placeholder
          isn't a reliable label, and this one changes every few seconds. */}
      <Input
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
    </form>
  );
}

// Shown while HeaderSearch waits on useSearchParams (which needs a
// Suspense boundary) - same box, first example, not yet interactive.
export function HeaderSearchFallback() {
  return (
    <div className={WRAPPER_CLASS}>
      <AiSparkles />
      <Input type="search" aria-label="Search" disabled placeholder={`“${EXAMPLES[0]}”`} className={INPUT_CLASS} />
    </div>
  );
}
