"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

// How far down the page has to scroll before the button becomes useful -
// below this, the top of the page is already close enough that a button
// to jump back to it would just be clutter.
const SHOW_AFTER_PX = 400;

// Appears once the page has scrolled far enough that getting back to the
// top by hand would be a real chore (a browse page can run to several
// dozen cards). Always rendered, not conditionally unmounted - visibility
// is a plain opacity/pointer-events toggle so it fades in and out instead
// of popping. Starts hidden (not a guess that could mismatch SSR - there
// is no "correct" scroll position to render for a request that hasn't
// reached the browser yet) and corrects itself from the real
// window.scrollY the moment this mounts.
export function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > SHOW_AFTER_PX);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      tabIndex={visible ? 0 : -1}
      className={cn(
        "fixed right-4 bottom-4 z-30 flex size-11 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg transition-opacity duration-200 hover:bg-neutral-800 sm:right-6 sm:bottom-6",
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      <ArrowUp className="size-5" />
    </button>
  );
}
