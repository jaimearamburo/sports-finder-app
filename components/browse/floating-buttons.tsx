"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE_SEARCH_ID } from "@/components/layout/header-search";

// Scroll depth before the buttons appear; above it, the top of the page is
// within easy reach.
const SHOW_AFTER_PX = 400;

// Mirrors the Next.js dev badge: 36px, 20px from the corner, 80% black with
// blur and a thin outline.
const BUTTON_CLASS =
  "flex size-9 items-center justify-center rounded-full bg-black/80 text-white backdrop-blur-[48px] shadow-[0_0_0_1px_#171717,inset_0_0_0_1px_rgba(255,255,255,0.14),0_16px_32px_-8px_rgba(0,0,0,0.24)] hover:bg-black";

// Browse's floating buttons in the bottom-right corner, where a right thumb
// rests: "Back to top" in the corner and, on phones only, "Search" 12px above
// it. They appear after scrolling SHOW_AFTER_PX; small and against the edge so
// they're hard to hit by accident.
//
// Always rendered, toggled with opacity and pointer-events so they fade. They
// start hidden (no scroll position on the server) and update from
// window.scrollY once mounted.
export function FloatingButtons() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > SHOW_AFTER_PX);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Hidden buttons leave the tab order and accessibility tree.
  const hidden = !visible;

  return (
    <div
      className={cn(
        "fixed right-5 bottom-5 z-30 flex flex-col gap-3 transition-opacity duration-200",
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      {/* The header is sticky, so focusing its search box needs no scrolling;
          being the user's own tap, it opens the phone keyboard. */}
      <button
        type="button"
        onClick={() => document.getElementById(SITE_SEARCH_ID)?.focus()}
        aria-label="Search"
        aria-hidden={hidden || undefined}
        tabIndex={hidden ? -1 : 0}
        className={cn(BUTTON_CLASS, "sm:hidden")}
      >
        <Search className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
        aria-hidden={hidden || undefined}
        tabIndex={hidden ? -1 : 0}
        className={BUTTON_CLASS}
      >
        <ArrowUp className="size-4" />
      </button>
    </div>
  );
}
