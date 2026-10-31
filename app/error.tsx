"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { NoticePage } from "@/components/notice-page";

// Root error boundary for routes under app/ (the root layout itself is
// app/global-error.tsx). "Try again" uses unstable_retry, which re-fetches;
// reset would only re-render and hit the same error. Shows only the error's
// digest (a reference to the server log), never its message or stack.
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
