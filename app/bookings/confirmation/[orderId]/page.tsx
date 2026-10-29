import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, CircleX, Hourglass } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { formatBookingTime } from "@/lib/dates";
import { getBookingReference } from "@/lib/booking-reference";
import { NoticePage } from "@/components/notice-page";
import { RefreshWhilePending } from "@/components/listings/refresh-while-pending";

// Minimal confirmation page, not a full "My Bookings" dashboard - that's
// its own later phase. Keyed by orderId rather than individual booking
// ids, since a multi-day pass finalizes into several Booking rows that
// all share one orderId, and this page shows all of them together.
//
// Also the page a payment lands on, so it covers the two in-between payment
// states as well (see completeOrderPayment in lib/bookings.ts): "pending"
// bookings whose card capture hasn't settled yet, which the webhook
// confirms shortly, and "cancelled" ones whose payment failed at capture.
export default async function BookingConfirmationPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const session = await auth();

  // Scoped to the current user - an orderId in the URL isn't trusted as
  // proof of ownership on its own.
  const bookings = session
    ? await prisma.booking.findMany({
        where: { orderId, userId: session.user.id },
        include: { listing: { include: { venue: { include: { city: true } }, activity: true } } },
        orderBy: { startsAt: "asc" },
      })
    : [];

  if (bookings.length === 0) notFound();

  // Every row in an order shares one payment, so they always share a status.
  const status = bookings[0].status;

  if (status === "cancelled") {
    return (
      <NoticePage
        icon={CircleX}
        tone="error"
        title="Payment didn't go through"
        actions={
          <Link href={`/listings/${bookings[0].listingId}`} className={buttonVariants({ variant: "default" })}>
            Back to slot selection
          </Link>
        }
      >
        <p>We couldn&apos;t complete your payment, so this booking wasn&apos;t made. Your card hasn&apos;t been charged.</p>
      </NoticePage>
    );
  }

  if (status === "pending") {
    return (
      <NoticePage icon={Hourglass} tone="muted" title="Finishing your payment" actions={<RefreshWhilePending />}>
        <p>Your booking is reserved and your payment is being confirmed. This page will update by itself.</p>
      </NoticePage>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center gap-6 px-4 py-16 text-center">
      <CheckCircle2 className="size-14 text-emerald-600" />
      <div>
        <h1 className="text-2xl font-bold">Booking confirmed</h1>
        <p className="text-muted-foreground">
          {bookings[0].attendeeName}, your {bookings.length > 1 ? "bookings are" : "booking is"} all set.
        </p>
        {/* A short, display-only code derived from orderId - the full
            orderId (already in this page's own URL) stays the real lookup
            key everywhere else; this is purely something a visitor can
            read aloud or write down. */}
        <p className="mt-2 text-sm text-muted-foreground">
          Booking reference: <span className="font-mono font-semibold text-foreground">{getBookingReference(orderId)}</span>
        </p>
      </div>

      <div className="flex w-full flex-col gap-3 text-left">
        {bookings.map((booking) => (
          <div key={booking.id} className="rounded-md border bg-card p-4">
            <p className="font-semibold">{booking.listing.name}</p>
            <p className="text-sm text-muted-foreground">
              {booking.listing.venue.name}, {booking.listing.venue.city.name}
            </p>
            {/* "× n" when the booking covers several people/passes - see
                the same label in My Bookings' detail dialog. */}
            <p className="mt-2 flex justify-between gap-3 text-sm">
              <span>
                {formatBookingTime(
                  booking.startsAt,
                  booking.endsAt,
                  booking.listing.venue.city.timezone,
                  booking.listing.activity
                )}
              </span>
              {booking.quantity > 1 && <span className="shrink-0 font-medium tabular-nums">× {booking.quantity}</span>}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonVariants({ variant: "default" })}>
          Back to browse
        </Link>
        <Link href="/account" className={buttonVariants({ variant: "outline" })}>
          View my bookings
        </Link>
      </div>
    </div>
  );
}
