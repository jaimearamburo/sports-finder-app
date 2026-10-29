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
    // Covers a nonexistent or someone else's orderId as well as a genuinely
    // expired one - a visitor can't tell them apart and doesn't need to;
    // either way the only next step is picking a slot again.
    return <HoldExpiredNotice listingId={listingId} />;
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
      // tags: only for the category label's colour - the first tag, the same
      // one app/listings/[id]/page.tsx takes its accent colour from.
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

