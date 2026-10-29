"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { NoticePage } from "@/components/notice-page";

// The root error boundary - catches any uncaught error thrown while
// rendering a route under app/ (but not the root layout itself - that's
// app/global-error.tsx). "Try again" calls unstable_retry, not reset:
// reset only re-renders the boundary's children without re-fetching, so a
// page that failed on a database query would just throw the same error
// again; unstable_retry re-fetches and re-renders. Deliberately never
// shows error.message/stack to the visitor - that's internal detail, not
// something a user can act on, and could leak implementation details in
// production - only its `digest` (a short, stable reference Next.js
// attaches to the server log entry for this error) so a real user could
// quote it if they contact support.
export default function Error({
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
    <NoticePage
      icon={TriangleAlert}
      tone="error"
      title="Something went wrong"
      actions={
        <>
          <Button variant="default" onClick={() => unstable_retry()}>
            Try again
          </Button>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            Back to browse
          </Link>
        </>
      }
    >
      <p>
        We hit an unexpected error loading this page. It&apos;s on us, not you - try again, or head back to browsing in
        the meantime.
      </p>
      {error.digest && <p className="font-mono text-xs">Reference: {error.digest}</p>}
    </NoticePage>
  );
}
