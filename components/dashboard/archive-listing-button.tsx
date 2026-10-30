"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { setListingArchivedAction } from "@/app/dashboard/listings/actions";

// Archive or restore one listing, after a confirmation dialog. Archiving is
// easy to undo (Restore), but it immediately takes the listing out of
// browse and new bookings, so it's worth one deliberate click. When the
// listing has upcoming bookings, the dialog says they're kept, since that's
// the first thing a manager will wonder.
// Archiving is the closest thing to a delete in the dashboard, so it's
// marked in Google's red for actions (#D93025, 4.6:1 with white text;
// the brighter brand red #EA4335 fails contrast). Restore stays a plain
// outline button.
const ARCHIVE_CLASS = "bg-[#d93025] text-white hover:bg-[#b3261e] focus-visible:border-[#d93025] focus-visible:ring-[#d93025]/30";

export function ArchiveListingButton({
  listingId,
  listingName,
  archived,
  upcomingBookings,
}: {
  listingId: string;
  listingName: string;
  archived: boolean;
  upcomingBookings: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await setListingArchivedAction(listingId, !archived);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      // Re-renders the venue page with the listing's new state.
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant={archived ? "outline" : "default"}
            size="sm"
            className={archived ? undefined : ARCHIVE_CLASS}
            aria-label={`${archived ? "Restore" : "Archive"} ${listingName}`}
          />
        }
      >
        {archived ? "Restore" : "Archive"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{archived ? `Restore ${listingName}?` : `Archive ${listingName}?`}</DialogTitle>
          <DialogDescription>
            {archived
              ? "It will appear in browse again and can be booked."
              : "It will be hidden from browse and can't be booked. You can restore it at any time."}
          </DialogDescription>
        </DialogHeader>
        {!archived && upcomingBookings > 0 && (
          <p className="rounded-md bg-muted px-3 py-2 text-sm">
            {upcomingBookings === 1
              ? "Its 1 upcoming booking will be kept."
              : `Its ${upcomingBookings} upcoming bookings will be kept.`}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={isPending} className={archived ? undefined : ARCHIVE_CLASS}>
            {isPending ? "Saving..." : archived ? "Restore" : "Archive"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
