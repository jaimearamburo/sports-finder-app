"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getBookableDates, isRequestedSlotValid } from "@/lib/availability";

export type BookListingResult = { ok: true; bookingId: string } | { ok: false; error: string };

export async function bookListing(input: {
  listingId: string;
  startsAt: Date;
  endsAt: Date;
  quantity?: number;
}): Promise<BookListingResult> {
  const session = await auth();
  if (!session) {
    return { ok: false, error: "You must be logged in to book." };
  }

  const listing = await prisma.listing.findUnique({
    where: { id: input.listingId },
    include: { venue: true, activity: true },
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

  try {
    const booking = await prisma.$transaction(async (tx) => {
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
