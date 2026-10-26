"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { releaseBookingHoldAction } from "@/app/listings/[id]/actions";

// Shown on any listing page while the logged-in user has an active hold
// anywhere (createBookingHold enforces at most one at a time, platform-
// wide) - proactively surfacing it here, rather than only after they try
// to start a second checkout and get rejected, with a direct way to
// finish or cancel it right from wherever they happen to be.
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

  async function handleCancel() {
    setIsCancelling(true);
    await releaseBookingHoldAction({ orderId });
    // Re-fetches this page's own server data in place rather than a hard
    // reload - the banner and blur disappear once the hold is actually
    // gone, since the page re-renders without one.
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
        {/* A Link has no native disabled state - without this, clicking
            Resume right after Cancel could still navigate to an orderId
            whose hold is already gone (or about to be), landing on the
            "hold expired" state instead of clearly doing nothing. */}
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
          {isCancelling ? "Cancelling..." : "Cancel"}
        </Button>
      </div>
    </div>
  );
}
