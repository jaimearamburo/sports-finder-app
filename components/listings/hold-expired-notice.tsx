import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { NoticePage } from "@/components/notice-page";

// Shown in two places with the same meaning: the checkout page when the
// hold is already gone (expired, finalized, or not this user's), and the
// checkout form when its countdown reaches zero while open. One component
// so the two can't drift apart in wording or style. notCharged adds a line
// for when the hold ran out during a payment attempt - the card was only
// authorized, and that authorization is released, so the customer should
// hear plainly that they weren't charged.
export function HoldExpiredNotice({ listingId, notCharged = false }: { listingId: string; notCharged?: boolean }) {
  return (
    <NoticePage
      icon={TriangleAlert}
      tone="error"
      title="Your hold has expired"
      actions={
        <Link href={`/listings/${listingId}`} className={buttonVariants({ variant: "default" })}>
          Back to slot selection
        </Link>
      }
    >
      <p>
        This slot was only held for a limited time and is no longer reserved for you. Go back and pick a slot again -
        it may still be available.
      </p>
      {notCharged && <p>Your card hasn&apos;t been charged.</p>}
    </NoticePage>
  );
}
