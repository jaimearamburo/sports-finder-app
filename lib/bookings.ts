import "server-only";
import { prisma } from "@/lib/prisma";
import { getBookableDates, isRequestedSlotValid } from "@/lib/availability";
import { withAuth } from "@/lib/auth-guards";

export type BookListingResult = { ok: true; bookingId: string } | { ok: false; error: string };

export const bookListing = withAuth(
  async (
    session,
    input: { listingId: string; startsAt: Date; endsAt: Date; quantity?: number }
  ): Promise<BookListingResult> => {
    // Fetches the listing along with its venue, city, and activity, all
    // required to re-validate the requested slot below.
    const listing = await prisma.listing.findUnique({
      where: { id: input.listingId },
      include: { venue: { include: { city: true } }, activity: true },
    });

    if (!listing || listing.archivedAt) {
      return { ok: false, error: "This listing is no longer available." };
    }

    // Never trust startsAt/endsAt as submitted - the picker UI enforces
    // these same rules, but only this re-check actually matters.
    const bookableDates = await getBookableDates(listing);
    if (!isRequestedSlotValid(listing, input.startsAt, input.endsAt, bookableDates)) {
      return { ok: false, error: "That time is no longer available." };
    }

    const quantity = input.quantity ?? 1;

    // ?? only catches null/undefined - a crafted 0 or negative quantity
    // would otherwise sail through, both dodging the capacity check below
    // (alreadyBooked + quantity > capacity gets harder or impossible to
    // trip) and permanently corrupting this listing's remaining-capacity
    // math afterward, since quantity gets summed into every later
    // overlap/capacity query (this function's own aggregate above, and
    // getSpotsRemaining).
    if (!Number.isInteger(quantity) || quantity < 1) {
      return { ok: false, error: "Invalid quantity." };
    }

    // The quantity stepper's own max is just UX - this is the check that
    // actually matters, same "never trust the client" reasoning as
    // isRequestedSlotValid above.
    if (listing.maxBookingsPerTransaction !== null && quantity > listing.maxBookingsPerTransaction) {
      return { ok: false, error: `This listing allows at most ${listing.maxBookingsPerTransaction} per booking.` };
    }

    try {
      const booking = await prisma.$transaction(async (tx) => {
        // Sums the quantity of non-cancelled bookings overlapping the
        // requested time range, to check against remaining capacity.
        const overlapping = await tx.booking.aggregate({
          where: {
            listingId: listing.id,
            status: { not: "cancelled" },
            startsAt: { lt: input.endsAt },
            endsAt: { gt: input.startsAt },
          },
          _sum: { quantity: true },
        });

        const alreadyBooked = overlapping._sum.quantity ?? 0;
        if (listing.capacity !== null && alreadyBooked + quantity > listing.capacity) {
          throw new Error("FULL");
        }

        // Creates the booking row inside the same transaction as the
        // capacity check above, so the check and the write stay atomic.
        return tx.booking.create({
          data: {
            listingId: listing.id,
            userId: session.user.id,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            quantity,
          },
        });
      });

      return { ok: true, bookingId: booking.id };
    } catch (error) {
      if (error instanceof Error && error.message === "FULL") {
        return { ok: false, error: "This slot just filled up - try another time." };
      }
      throw error;
    }
  }
);
