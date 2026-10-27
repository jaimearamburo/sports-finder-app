"use client";

import { useEffect, useState } from "react";

// Built from individual parts (not one locale-formatted string) so the
// exact layout - "Tue, 26 October 8:27 PM" - doesn't depend on whatever
// punctuation/ordering a given Intl locale happens to default to (en-US's
// own default, for instance, abbreviates the month and puts a comma before
// the time - neither of which is what's wanted here).
function formatTime(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    second: "numeric",
    hour12: true,
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("weekday")}, ${get("day")} ${get("month")} ${get("hour")}:${get("minute")}:${get("second")} ${get("dayPeriod")}`;
}

// Every date/time on this page is computed relative to the venue's own
// timezone (see lib/dates.ts's todayInTimezone and lib/time-of-day.ts's
// zonedOccurrenceStart), which is easy to miss as a visitor unless it's
// stated outright - this makes that explicit and shows it's genuinely
// live, not a one-off server-rendered timestamp that goes stale.
//
// Mount-gated: renders nothing until the first client-side effect fires,
// since "the current time" is a different value on every render by
// definition - rendering it during the server pass would never match
// what the client renders on hydration, which React treats as a
// hydration error.
export function VenueLocalTime({ timeZone, cityName }: { timeZone: string; cityName: string }) {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setTime(formatTime(timeZone));
    // Deferred, not a direct setState() call in the effect body - fires
    // the first tick almost immediately after mount without tripping
    // react-hooks/set-state-in-effect, which otherwise flags any
    // synchronous state update inside an effect.
    const initialTimeout = setTimeout(tick, 0);

    // Re-syncs to the next real wall-clock second boundary instead of just
    // ticking every 1000ms from whatever moment this component happened to
    // mount. Date.now() % 1000 is timezone-agnostic (a second boundary is
    // the same real-world instant everywhere) - without this, mounting at,
    // say, 350ms into a second would leave the displayed time showing the
    // old second for up to another 650ms after the real second actually
    // changed, since a mount-anchored interval has no reason to land on
    // an exact :000ms mark.
    let interval: ReturnType<typeof setInterval> | undefined;
    const alignTimeout = setTimeout(
      () => {
        tick();
        interval = setInterval(tick, 1000);
      },
      1000 - (Date.now() % 1000)
    );

    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(alignTimeout);
      if (interval) clearInterval(interval);
    };
  }, [timeZone]);

  if (!time) return null;

  return (
    <p className="mt-2 text-sm text-black/80 bg-amber-100/50 p-2 rounded-sm">
      All dates and times are displayed in the venue&apos;s local time. <br></br>
      Current time in{" "}
      <span className="text-base font-semibold text-[#1967D2]">{cityName}</span>
      {" - "}
      <span className="font-medium text-foreground">{time}</span>.
    </p>
  );
}
