import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { HoldExpiredNotice } from "@/components/listings/hold-expired-notice";
import { getTotalPrice, getBreakdownLine } from "@/lib/booking-price";
import { formatBookingTime } from "@/lib/dates";
import { CheckoutForm } from "@/components/listings/checkout-form";
import { PAYMENT_CURRENCY, toMinorUnits } from "@/lib/stripe";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ id: string; orderId: string }>;
}) {
  const { id: listingId, orderId } = await params;
  const session = await auth();

  // Every hold in this order (a pass has one per day), checked out together
  // under one countdown. Scoped to the current user and listing: the orderId in
  // the URL proves nothing.
  const holds = session
    ? await prisma.bookingHold.findMany({
        where: { orderId, userId: session.user.id, listingId },
      })
    : [];

  const stillActive = holds.length > 0 && holds.every((h) => h.expiresAt > new Date());

  if (!session || !stillActive) {
    // Nonexistent, someone else's or expired: the visitor's next step is the
    // same either way.
    return <HoldExpiredNotice listingId={listingId} />;
  }

  // Enough for the summary and total; the holds define the slots and quantity.
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      name: true,
      pricePerUnit: true,
      venue: { select: { name: true, city: { select: { name: true, timezone: true } } } },
      // The first tag, for the category label's colour (as on the listing
      // page).
      activity: {
        select: { name: true, bookingMechanic: true, isAccommodation: true, tags: { select: { tag: { select: { color: true } } } } },
      },
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
  // One line per slot: a pass shows each day, not a range implying the days
  // between.
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
      accentColor={listing.activity.tags[0]?.tag.color}
      venueName={listing.venue.name}
      cityName={listing.venue.city.name}
      scheduleLines={scheduleLines}
      quantity={quantity}
      total={total}
      amountMinor={toMinorUnits(total)}
      currency={PAYMENT_CURRENCY}
      breakdown={breakdown}
      defaultName={session.user.name ?? ""}
      defaultEmail={session.user.email ?? ""}
    />
  );
}

