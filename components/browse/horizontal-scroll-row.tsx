"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Generic horizontal scroll row with arrow navigation and no visible
// scrollbar - caps a tag group's initial on-screen height to roughly one
// row of cards instead of the browse page growing into an endless vertical
// scroll by default. Takes arbitrary children (not listing-specific), so
// it's reusable wherever a card row needs this treatment; the caller is
// responsible for giving each child a fixed width, since a flex row (unlike
// the grid ListingGrid normally uses) needs one to know where a card ends.
// Eases from the container's current scrollLeft to a clamped target over a
// fixed duration, driven by our own requestAnimationFrame loop rather than
// the browser's native `scrollBy({ behavior: "smooth" })` - that native
// animation turned out unreliable here (its duration is short enough for a
// ~700px jump to read as an instant cut rather than a visible slide, and a
// second click fired before it finished could get dropped rather than
// starting a fresh animation). Owning the loop means every click
// deterministically cancels whatever's in flight and starts a new,
// consistently-paced scroll from wherever the container actually is right
// now.
function animateScrollTo(el: HTMLElement, target: number, duration: number): number {
  const start = el.scrollLeft;
  const change = target - start;
  const startTime = performance.now();

  function easeOutCubic(t: number) {
    return 1 - (1 - t) ** 3;
  }

  let frameId = 0;
  function step(now: number) {
    const progress = Math.min((now - startTime) / duration, 1);
    el.scrollLeft = start + change * easeOutCubic(progress);
    if (progress < 1) frameId = requestAnimationFrame(step);
  }
  frameId = requestAnimationFrame(step);
  return frameId;
}

export function HorizontalScrollRow({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function updateArrows() {
      if (!el) return;
      setCanScrollLeft(el.scrollLeft > 0);
      // -1px tolerance for sub-pixel rounding at the end of the scroll range.
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    }

    updateArrows();
    const resizeObserver = new ResizeObserver(updateArrows);
    resizeObserver.observe(el);
    el.addEventListener("scroll", updateArrows);
    return () => {
      resizeObserver.disconnect();
      el.removeEventListener("scroll", updateArrows);
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Measured off the first child's actual rendered width rather than a
  // hardcoded pixel guess, so this keeps working if card width ever
  // changes (a different breakpoint, a redesign) without touching this file.
  function scrollByCards(direction: 1 | -1) {
    const el = scrollRef.current;
    const firstCard = el?.firstElementChild as HTMLElement | null;
    if (!el || !firstCard) return;
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);

    const gap = parseFloat(getComputedStyle(el).columnGap || "0");
    const cardWidth = firstCard.getBoundingClientRect().width + gap;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const target = Math.max(0, Math.min(el.scrollLeft + cardWidth * 3 * direction, maxScroll));
    animationFrameRef.current = animateScrollTo(el, target, 450);
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-none"
      >
        {children}
      </div>
      {/* Fades to the page background at whichever edge still has hidden
          content, mirroring the same scroll-position-driven show/hide the
          arrows already use (not the static one-directional mask-image
          fade the tag chip row uses - this needs to react to actual scroll
          position on both edges, not just always fade one fixed side).
          pointer-events-none so it never blocks clicks on the cards or
          arrow underneath/above it; bg-linear-to-* is Tailwind v4's
          renamed bg-gradient-to-* utility (verified against this
          project's actual installed version, not assumed from training
          data). */}
      {canScrollLeft && (
        <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-linear-to-r from-background to-transparent" />
      )}
      {canScrollRight && (
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-linear-to-l from-background to-transparent" />
      )}
      {/* Always mounted, never unmounted at the scroll limit - deliberately
          NOT the native `disabled` attribute, since this Button's shared
          disabled styling bakes in pointer-events-none, which would let a
          click at the limit fall straight through to the card underneath -
          exactly the accidental-click problem this is meant to prevent.
          aria-disabled + a dimmed opacity signal "inactive" without giving
          up the click, so the button keeps absorbing clicks at the edge
          (scrollByCards itself becomes a harmless no-op there, since its
          target is already clamped to the current position). */}
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-disabled={!canScrollLeft}
        className={cn(
          "absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-card shadow-md active:-translate-y-1/2!",
          !canScrollLeft && "opacity-40"
        )}
        onClick={() => scrollByCards(-1)}
        aria-label="Scroll left"
      >
        <ChevronLeft />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-disabled={!canScrollRight}
        className={cn(
          "absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 rounded-full bg-card shadow-md active:-translate-y-1/2!",
          !canScrollRight && "opacity-40"
        )}
        onClick={() => scrollByCards(1)}
        aria-label="Scroll right"
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
