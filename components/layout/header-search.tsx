"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

// Example queries shown in rotation, to signal that the search box takes
// plain language rather than exact names. Each uses an activity and city
// that actually exist in the data, so they'll make sense once search is
// wired up.
const EXAMPLES = [
  "tennis in Sydney this weekend",
  "yoga class on Saturday morning",
  "camping in the Blue Mountains",
  "padel court in Sydney tomorrow",
  "gym day pass in Manhattan",
];

const ROTATE_MS = 3500;

export function HeaderSearch() {
  const [index, setIndex] = useState(0);
  const [focused, setFocused] = useState(false);

  // Paused while the box is focused, so the hint doesn't change under
  // someone who has just clicked in to read or type.
  useEffect(() => {
    if (focused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % EXAMPLES.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [focused]);

  return (
    // max-w-160 (640px): from md up the header gives the search a flexible
    // column, so the cap moves here to keep the box its usual width.
    <div className="relative w-full max-w-160 min-w-0">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-muted-foreground" />
      {/* aria-label, not the placeholder, names the field: a placeholder
          isn't a reliable label, and this one changes every few seconds.
          Typed text keeps the shared Input's 16px on phones - iPhone
          Safari zooms the page in on focus for anything smaller - and only
          the placeholder is shrunk to 14px (placeholder:text-sm) so more
          of each example fits; text-ellipsis ends anything that still
          doesn't fit in "…". */}
      <Input
        type="search"
        aria-label="Search"
        placeholder={`“${EXAMPLES[index]}”`}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="h-11 rounded-xl bg-muted/40 pl-10 text-ellipsis placeholder:text-sm"
      />
    </div>
  );
}
