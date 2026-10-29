import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { NoticePage } from "@/components/notice-page";

// Site-wide 404: any unknown URL, plus any notFound() call that has no
// closer not-found.tsx - currently the booking confirmation page, for an
// orderId that doesn't exist or belongs to someone else (deliberately the
// same response for both, so a guessed orderId reveals nothing). Listing
// and checkout pages have their own, more specific
// app/listings/[id]/not-found.tsx. A fixed link home rather than browser
// back, since a visitor landing on a dead URL may have no history at all.
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
