import Link from "next/link";
import { notFound } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { getTotalPrice, getBreakdownLine } from "@/lib/booking-price";
import { formatBookingTime } from "@/lib/dates";
import { CheckoutForm } from "@/components/listings/checkout-form";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ id: string; orderId: string }>;
}) {
  const { id: listingId, orderId } = await params;
  const session = await auth();

  // Fetches every hold in this order - a non-accommodation date_range
  // "pass" (several individually-picked days) creates one BookingHold per
  // day, all sharing this orderId, and this page checks out the whole
  // order at once under one shared countdown. Scoped to the current user
  // and this listing - ownership isn't trusted from the URL, since an
  // orderId is just a plain string a visitor could edit by hand.
  const holds = session
    ? await prisma.bookingHold.findMany({
        where: { orderId, userId: session.user.id, listingId },
      })
    : [];

  const stillActive = holds.length > 0 && holds.every((h) => h.expiresAt > new Date());

  if (!session || !stillActive) {
    return <HoldExpired listingId={listingId} />;
  }

  // Fetches just enough to show a summary and compute the total - the
  // hold itself is already the source of truth for which slots and how
  // much quantity were reserved.
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      name: true,
      pricePerUnit: true,
      venue: { select: { name: true, city: { select: { name: true, timezone: true } } } },
      activity: { select: { name: true, bookingMechanic: true, isAccommodation: true } },
    },
  });
  if (!listing) notFound();

  const priceInfo = {
    bookingMechanic: listing.activity.bookingMechanic,
    pricePerUnit: Number(listing.pricePerUnit),
    isAccommodation: listing.activity.isAccommodation,
  };
  const slots = holds.map((h) => ({ startsAt: h.startsAt, endsAt: h.endsAt }));
  const quantity = holds[0].quantity;
  const total = getTotalPrice(priceInfo, slots) * quantity;
  const breakdown = getBreakdownLine(priceInfo, slots);
  // One line per slot - a multi-day pass checks out several at once, and
  // each needs its own line rather than one range that would wrongly
  // imply the days in between are included too.
  const scheduleLines = slots.map((slot) =>
    formatBookingTime(slot.startsAt, slot.endsAt, listing.venue.city.timezone, listing.activity)
  );

  return (
    <CheckoutForm
      orderId={orderId}
      expiresAt={holds[0].expiresAt}
      listingId={listingId}
      listingName={listing.name}
      activityName={listing.activity.name}
      venueName={listing.venue.name}
      cityName={listing.venue.city.name}
      scheduleLines={scheduleLines}
      quantity={quantity}
      total={total}
      breakdown={breakdown}
      defaultName={session.user.name ?? ""}
      defaultEmail={session.user.email ?? ""}
    />
  );
}

// Covers both a nonexistent/foreign orderId and a genuinely expired one -
// a visitor can't tell the difference from the outside, and shouldn't
// need to; either way, the only real next step is going back to pick a
// slot again.
function HoldExpired({ listingId }: { listingId: string }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center">
      <TriangleAlert className="size-14 text-destructive" />
      <h1 className="text-2xl font-bold text-destructive">Your hold has expired</h1>
      <p className="text-muted-foreground">
        This slot was only held for a limited time and is no longer reserved for you. Go back and pick a slot again
        - it may still be available.
      </p>
      <Link href={`/listings/${listingId}`} className={buttonVariants({ variant: "default", className: "mt-3" })}>
        Back to slot selection
      </Link>
    </div>
  );
}
