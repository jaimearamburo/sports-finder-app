"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE_SEARCH_ID } from "@/components/layout/header-search";

// How far down the page has to scroll before the buttons are useful - above
// this, the top of the page and the search box are already in easy reach.
const SHOW_AFTER_PX = 400;

// Styled as a mirror of the Next.js dev badge (bottom-left in development):
// 36px, 20px from the corner, 80% black with a blur and a thin outline. The
// badge isn't there in production, but the buttons keep the same look.
const BUTTON_CLASS =
  "flex size-9 items-center justify-center rounded-full bg-black/80 text-white backdrop-blur-[48px] shadow-[0_0_0_1px_#171717,inset_0_0_0_1px_rgba(255,255,255,0.14),0_16px_32px_-8px_rgba(0,0,0,0.24)] hover:bg-black";

// Browse's floating buttons, stacked in the bottom-right corner where a
// right thumb rests while scrolling: "Back to top" in the corner and, on
// phones only, "Search" 12px above it. Both appear once the page has
// scrolled far enough to need them. Small and against the edge, away from
// the cards people tap, so they're hard to hit by accident.
//
// Always rendered rather than mounted on scroll: visibility is an
// opacity/pointer-events toggle so they fade in and out. They start hidden
// (there's no scroll position to render on the server) and correct
// themselves from window.scrollY once mounted.
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

  // Hidden buttons leave the tab order and the accessibility tree.
  const hidden = !visible;

  return (
    <div
      className={cn(
        "fixed right-5 bottom-5 z-30 flex flex-col gap-3 transition-opacity duration-200",
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      {/* The header stays stuck to the top, so focusing its search box
          needs no scrolling; the tap is the user's own gesture, so phones
          open the keyboard. */}
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
