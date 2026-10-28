import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

// Site-wide 404: any unknown URL, plus any notFound() call that has no
// closer not-found.tsx - currently the booking confirmation page, for an
// orderId that doesn't exist or belongs to someone else (deliberately the
// same response for both, so a guessed orderId reveals nothing). Listing
// and checkout pages have their own, more specific
// app/listings/[id]/not-found.tsx. A fixed link home rather than browser
// back, since a visitor landing on a dead URL may have no history at all.
export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center">
      <SearchX className="size-14 text-muted-foreground" />
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist, or the link may be out of date.
      </p>
      <Link href="/" className={buttonVariants({ variant: "default", className: "mt-3" })}>
        Back to browse
      </Link>
    </div>
  );
}
