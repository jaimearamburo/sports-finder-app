import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { NoticePage } from "@/components/notice-page";

// Site-wide 404: unknown URLs and notFound() calls without a closer
// not-found.tsx (e.g. a confirmation page for a missing or someone else's
// order, which look the same). Links home rather than back: the visitor may
// have no history.
export default function NotFound() {
  return (
    <NoticePage
      icon={SearchX}
      tone="muted"
      title="Page not found"
      actions={
        <Link href="/" className={buttonVariants({ variant: "default" })}>
          Back to browse
        </Link>
      }
    >
      <p>The page you&apos;re looking for doesn&apos;t exist, or the link may be out of date.</p>
    </NoticePage>
  );
}
