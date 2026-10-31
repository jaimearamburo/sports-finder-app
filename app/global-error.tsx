"use client";

import { useEffect } from "react";
import "./globals.css";

// Catches errors from the root layout itself, e.g. SiteHeader's auth() when the
// database is unreachable. Replaces the whole document, so it renders its own
// <html> and <body>, imports globals.css directly, and depends on nothing that
// might have failed.
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
          <p className="font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>
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
