import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { NoticePage } from "@/components/notice-page";

// Shown on the checkout page when the hold is gone, and in the checkout form
// when its countdown ends. notCharged adds a line for a hold that expired
// during payment: the authorization is released, so nothing was charged.
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
