"use client";

import { useEffect, useState } from "react";

// Built from parts so the layout ("Tue, 26 October 8:27 PM") doesn't depend on
// a locale's punctuation.
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

// Shows the venue's live local time, since every date and time on the page uses
// the venue's timezone. Renders nothing until mounted: the current time can't
// match between server and client render.
export function VenueLocalTime({ timeZone, cityName }: { timeZone: string; cityName: string }) {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setTime(formatTime(timeZone));
    // Deferred so the first tick isn't a synchronous setState in the effect
    // (react-hooks/set-state-in-effect).
    const initialTimeout = setTimeout(tick, 0);

    // Aligned to real second boundaries, so the display changes when the second
    // does rather than up to a second late.
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
    // Neutral grey: information, not a hold warning (amber).
    <p className="mt-2 rounded-md bg-muted p-3 text-sm text-foreground">
      All dates and times are displayed in the venue&apos;s local time. <br></br>
      Current time in{" "}
      <span className="text-base font-semibold text-[#1967D2]">{cityName}</span>
      {" - "}
      <span className="font-medium text-foreground">{time}</span>.
    </p>
  );
}
