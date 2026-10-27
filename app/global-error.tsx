"use client";

import { useEffect } from "react";
import "./globals.css";

// Last-resort boundary for errors thrown by the root layout itself, which
// app/error.tsx can't catch (an error.tsx never wraps the layout of its own
// segment). The realistic trigger is SiteHeader, which calls auth() on
// every page - if that fails (e.g. the database is unreachable), this
// replaces the whole document. That's why it renders its own <html> and
// <body> and imports globals.css directly: the root layout, with its
// header, footer and fonts, is exactly the part that failed. Kept
// deliberately plain for the same reason - nothing here should depend on
// anything that might itself be what broke.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <title>Something went wrong | PlayBook</title>
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="max-w-md text-muted-foreground">
          We couldn&apos;t load PlayBook right now. Please try again in a moment.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-muted-foreground/60">Reference: {error.digest}</p>
        )}
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
