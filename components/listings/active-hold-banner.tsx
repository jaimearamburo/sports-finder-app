"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { releaseBookingHoldAction } from "@/app/listings/[id]/actions";

// Shown on every listing page while the user has an active hold anywhere (one
// per user), with links to resume or cancel it.
export function ActiveHoldBanner({
  orderId,
  listingId,
  listingName,
  venueName,
}: {
  orderId: string;
  listingId: string;
  listingName: string;
  venueName: string;
}) {
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);

  // Scroll to the top when the banner appears. Returning from checkout restores
  // the listing's old scroll position (usually the bottom), and the banner
  // arrives a moment later via RefreshOnHistoryNavigation, out of sight. The
  // rest of the page is inert until the hold is resolved.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  async function handleCancel() {
    setIsCancelling(true);
    await releaseBookingHoldAction({ orderId });
    // Re-fetch server data in place; the banner disappears once the hold is
    // gone.
    router.refresh();
  }

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        <p>
          You have a booking in progress for <strong>{listingName}</strong> ({venueName}). Finish or cancel it
          before starting another.
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {/* Links have no disabled state; this stops Resume navigating to a hold
            that is being cancelled. */}
        <Link
          href={`/listings/${listingId}/checkout/${orderId}`}
          aria-disabled={isCancelling}
          onClick={(e) => isCancelling && e.preventDefault()}
          className={buttonVariants({
            variant: "outline",
            size: "sm",
            className: isCancelling ? "pointer-events-none opacity-50" : undefined,
          })}
        >
          Resume checkout
        </Link>
        <Button variant="destructive" size="sm" onClick={handleCancel} disabled={isCancelling}>
          {isCancelling ? "Cancelling..." : "Cancel booking"}
        </Button>
      </div>
    </div>
  );
}
