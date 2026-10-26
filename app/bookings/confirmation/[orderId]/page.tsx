import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { formatBookingTime } from "@/lib/dates";

// Minimal confirmation page, not a full "My Bookings" dashboard - that's
// its own later phase. Keyed by orderId rather than individual booking
// ids, since a multi-day pass finalizes into several Booking rows that
// all share one orderId, and this page shows all of them together.
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
        include: { listing: { include: { venue: { include: { city: true } } } } },
        orderBy: { startsAt: "asc" },
      })
    : [];

  if (bookings.length === 0) notFound();

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
          Booking reference: <span className="font-mono font-semibold text-foreground">{orderId.slice(0, 8).toUpperCase()}</span>
        </p>
      </div>

      <div className="flex w-full flex-col gap-3 text-left">
        {bookings.map((booking) => (
          <div key={booking.id} className="rounded-md border bg-card p-4">
            <p className="font-semibold">{booking.listing.name}</p>
            <p className="text-sm text-muted-foreground">
              {booking.listing.venue.name}, {booking.listing.venue.city.name}
            </p>
            <p className="mt-2 text-sm">
              {formatBookingTime(booking.startsAt, booking.endsAt, booking.listing.venue.city.timezone)}
            </p>
          </div>
        ))}
      </div>

      <Link href="/" className={buttonVariants({ variant: "default" })}>
        Back to browse
      </Link>
    </div>
  );
}
