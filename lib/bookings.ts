import "server-only";
import { prisma } from "@/lib/prisma";
import { getBookableDates, isRequestedSlotValid } from "@/lib/availability";
import { getTotalPrice } from "@/lib/booking-price";
import { getBookingReference } from "@/lib/booking-reference";
import { withAuth } from "@/lib/auth-guards";

export type CreateBookingHoldResult =
  | { ok: true; orderId: string; expiresAt: Date }
  | { ok: false; error: string };

export type FinalizeBookingHoldResult = { ok: true; orderId: string } | { ok: false; error: string };

export type ReleaseBookingHoldResult = { ok: true } | { ok: false; error: string };

type Slot = { startsAt: Date; endsAt: Date };
// slots is always an array, even though time_range, fixed_session, and an
// accommodation date_range always produce exactly one entry - only a
// non-accommodation date_range "pass" (several individually-picked days,
// e.g. the 19th/23rd/30th) ever produces more than one. Keeping this plural
// everywhere avoids a separate single-slot code path that the multi-day
// case would otherwise have to awkwardly bypass.
type HoldInput = { listingId: string; slots: Slot[]; quantity?: number };

// Fetches the listing and re-validates every requested slot against it,
// shared by createBookingHold so the hold step and the picker UI it
// follows can never silently disagree on what counts as a legal request.
async function loadAndValidateListing(input: HoldInput) {
  if (input.slots.length === 0) {
    return { ok: false as const, error: "No slot was selected." };
  }

  const listing = await prisma.listing.findUnique({
    where: { id: input.listingId },
    include: { venue: { include: { city: true } }, activity: true },
  });

  if (!listing || listing.archivedAt) {
    return { ok: false as const, error: "This listing is no longer available." };
  }

  const bookableDates = await getBookableDates(listing);
  for (const slot of input.slots) {
    if (!isRequestedSlotValid(listing, slot.startsAt, slot.endsAt, bookableDates)) {
      return { ok: false as const, error: "That time is no longer available." };
    }
  }

  const quantity = input.quantity ?? 1;

  // ?? only catches null/undefined - a crafted 0 or negative quantity
  // would otherwise sail through, both dodging the capacity check below
  // and permanently corrupting this listing's remaining-capacity math
  // afterward, since quantity gets summed into every later overlap/
  // capacity query.
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false as const, error: "Invalid quantity." };
  }

  // The quantity stepper's own max is just UX - this is the check that
  // actually matters, same "never trust the client" reasoning as
  // isRequestedSlotValid above.
  if (listing.maxBookingsPerTransaction !== null && quantity > listing.maxBookingsPerTransaction) {
    return {
      ok: false as const,
      error: `This listing allows at most ${listing.maxBookingsPerTransaction} per booking.`,
    };
  }

  return { ok: true as const, listing, quantity };
}

// Reserves every selected slot for the duration of checkout, under one
// shared orderId, rather than creating the Booking(s) directly - this is
// the actual contested resource, so the capacity race-safety below lives
// here, not at final submission. All slots in one request succeed or
// fail together: a 3-day pass missing even one of its picked days isn't
// a valid purchase.
export const createBookingHold = withAuth(
  async (session, input: HoldInput): Promise<CreateBookingHoldResult> => {
    const validated = await loadAndValidateListing(input);
    if (!validated.ok) return validated;
    const { listing, quantity } = validated;

    const holdMinutes = listing.holdDurationMinutes ?? listing.venue.holdDurationMinutes;
    const expiresAt = new Date(Date.now() + holdMinutes * 60000);
    const orderId = crypto.randomUUID();

    try {
      await prisma.$transaction(async (tx) => {
        // Locks this user's own row first, for the one-active-hold-per-
        // user check right below - without this, two concurrent requests
        // from the same user (a double-click, two tabs) could both see
        // "no active hold yet" and both proceed, defeating the whole
        // point of the check. Same technique as the listing-row lock
        // further down, just scoped to the user instead of the listing.
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${session.user.id} FOR UPDATE`;

        const existingHold = await tx.bookingHold.findFirst({
          where: { userId: session.user.id, expiresAt: { gt: new Date() } },
        });
        if (existingHold) {
          throw new Error("ALREADY_HAS_HOLD");
        }

        // Locks this listing's row for the rest of the transaction, once,
        // covering every slot below. Under Postgres's default Read
        // Committed isolation, two concurrent requests could otherwise
        // both read the same "not full yet" capacity sum before either
        // commits, and both succeed - this lock forces a second
        // concurrent attempt on the same listing to wait here until this
        // transaction commits or rolls back, so it always re-reads an
        // up-to-date sum.
        await tx.$queryRaw`SELECT id FROM listings WHERE id = ${listing.id} FOR UPDATE`;

        for (const slot of input.slots) {
          // Capacity already claimed by confirmed bookings and by other
          // still-active holds for this specific slot (expired holds are
          // excluded here rather than deleted by a cleanup job - see
          // BookingHold's own schema comment).
          const [bookedSum, heldSum] = await Promise.all([
            tx.booking.aggregate({
              where: {
                listingId: listing.id,
                status: { not: "cancelled" },
                startsAt: { lt: slot.endsAt },
                endsAt: { gt: slot.startsAt },
              },
              _sum: { quantity: true },
            }),
            tx.bookingHold.aggregate({
              where: {
                listingId: listing.id,
                expiresAt: { gt: new Date() },
                startsAt: { lt: slot.endsAt },
                endsAt: { gt: slot.startsAt },
              },
              _sum: { quantity: true },
            }),
          ]);

          const used = (bookedSum._sum.quantity ?? 0) + (heldSum._sum.quantity ?? 0);
          if (listing.capacity !== null && used + quantity > listing.capacity) {
            throw new Error("FULL");
          }

          await tx.bookingHold.create({
            data: {
              orderId,
              listingId: listing.id,
              userId: session.user.id,
              startsAt: slot.startsAt,
              endsAt: slot.endsAt,
              quantity,
              expiresAt,
            },
          });
        }
      });

      return { ok: true, orderId, expiresAt };
    } catch (error) {
      if (error instanceof Error && error.message === "FULL") {
        return { ok: false, error: "This slot just filled up - try another time." };
      }
      if (error instanceof Error && error.message === "ALREADY_HAS_HOLD") {
        return { ok: false, error: "You already have a booking in progress. Finish or cancel it first." };
      }
      throw error;
    }
  }
);

// Converts every hold in the order into a permanent, confirmed Booking.
// Capacity-neutral by design - the holds already reserved this capacity,
// so this never needs to re-run the capacity check itself, only confirm
// the order is still genuinely valid at the moment it's consumed.
export const finalizeBookingHold = withAuth(
  async (
    session,
    input: { orderId: string; attendeeName: string; attendeeEmail: string; attendeePhone?: string }
  ): Promise<FinalizeBookingHoldResult> => {
    const attendeeName = input.attendeeName.trim();
    const attendeeEmail = input.attendeeEmail.trim().toLowerCase();
    if (!attendeeName || !attendeeEmail) {
      return { ok: false, error: "Attendee name and email are required." };
    }

    try {
      await prisma.$transaction(async (tx) => {
        const holds = await tx.bookingHold.findMany({
          where: { orderId: input.orderId, userId: session.user.id },
        });
        if (holds.length === 0) {
          throw new Error("NOT_FOUND");
        }

        // Locks the same listing row createBookingHold locks. Without
        // this, a hold that expires right at this moment could be
        // converted here at the same instant a different transaction
        // decides it no longer counts and hands that same capacity to
        // someone else - this lock forces the two to serialize instead.
        await tx.$queryRaw`SELECT id FROM listings WHERE id = ${holds[0].listingId} FOR UPDATE`;

        const now = new Date();
        if (holds.some((h) => h.expiresAt <= now)) {
          throw new Error("EXPIRED");
        }

        // Status is set explicitly to "confirmed" rather than left at its
        // "pending" default - "pending" is reserved for a real
        // asynchronous gap between recording a booking and confirming
        // payment (the eventual Stripe webhook flow), which doesn't
        // exist yet with this stubbed billing step. There's no later
        // step that would ever move a "pending" row forward today.
        const listing = await tx.listing.findUnique({
          where: { id: holds[0].listingId },
          select: { pricePerUnit: true, activity: { select: { bookingMechanic: true, isAccommodation: true } } },
        });
        if (!listing) throw new Error("NOT_FOUND");
        const priceInfo = {
          bookingMechanic: listing.activity.bookingMechanic,
          pricePerUnit: Number(listing.pricePerUnit),
          isAccommodation: listing.activity.isAccommodation,
        };

        await tx.bookingHold.deleteMany({ where: { orderId: input.orderId, userId: session.user.id } });
        await Promise.all(
          holds.map((hold) =>
            tx.booking.create({
              data: {
                orderId: input.orderId,
                listingId: hold.listingId,
                userId: session.user.id,
                startsAt: hold.startsAt,
                endsAt: hold.endsAt,
                quantity: hold.quantity,
                status: "confirmed",
                amountPaid: getTotalPrice(priceInfo, [{ startsAt: hold.startsAt, endsAt: hold.endsAt }]) * hold.quantity,
                attendeeName,
                attendeeEmail,
                attendeePhone: input.attendeePhone?.trim() || null,
              },
            })
          )
        );
      });

      return { ok: true, orderId: input.orderId };
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_FOUND") {
        return { ok: false, error: "This booking hold could not be found." };
      }
      if (error instanceof Error && error.message === "EXPIRED") {
        return { ok: false, error: "Your hold has expired." };
      }
      throw error;
    }
  }
);

// Explicitly releases an order's holds before they expire on their own -
// e.g. the checkout page's "Back to listing" action, or the active-hold
// banner's "Cancel" button. Ownership-scoped: deleteMany's where clause
// only ever matches rows that are both in this order and owned by this
// session's user, so it can't be used to release someone else's hold.
// No-op (still ok: true) if the holds are already gone - already
// finalized or already expired holds have nothing left to release, and
// the caller is moving on regardless.
export const releaseBookingHold = withAuth(
  async (session, input: { orderId: string }): Promise<ReleaseBookingHoldResult> => {
    await prisma.bookingHold.deleteMany({
      where: { orderId: input.orderId, userId: session.user.id },
    });
    return { ok: true };
  }
);

export type BookingOrderSlot = { id: string; startsAt: Date; endsAt: Date; quantity: number };

export type BookingOrder = {
  orderId: string;
  reference: string;
  status: "upcoming" | "past";
  listingName: string;
  venueName: string;
  cityName: string;
  timeZone: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone: string | null;
  totalAmountPaid: number;
  slots: BookingOrderSlot[];
};

// Every order (one or more Booking rows sharing an orderId) the signed-in
// user has ever made, for the "My Bookings" page - the same grouping the
// confirmation page already does for a single order, just across all of
// them. "Upcoming" vs "past" is decided by the LATEST slot in the order,
// not the earliest: a multi-day pass whose first day has already gone but
// whose last day hasn't is still something the user hasn't finished using,
// so it stays "upcoming" until every slot in it has.
export const getUserBookingOrders = withAuth(async (session): Promise<BookingOrder[]> => {
  const bookings = await prisma.booking.findMany({
    where: { userId: session.user.id },
    include: { listing: { include: { venue: { include: { city: true } } } } },
    orderBy: { startsAt: "asc" },
  });

  const byOrder = new Map<string, typeof bookings>();
  for (const booking of bookings) {
    const existing = byOrder.get(booking.orderId);
    if (existing) existing.push(booking);
    else byOrder.set(booking.orderId, [booking]);
  }

  const now = new Date();
  const orders: BookingOrder[] = [];
  for (const [orderId, rows] of byOrder) {
    const first = rows[0];
    const latestEnd = rows.reduce((max, r) => (r.endsAt > max ? r.endsAt : max), rows[0].endsAt);
    orders.push({
      orderId,
      reference: getBookingReference(orderId),
      status: latestEnd > now ? "upcoming" : "past",
      listingName: first.listing.name,
      venueName: first.listing.venue.name,
      cityName: first.listing.venue.city.name,
      timeZone: first.listing.venue.city.timezone,
      attendeeName: first.attendeeName,
      attendeeEmail: first.attendeeEmail,
      attendeePhone: first.attendeePhone,
      totalAmountPaid: rows.reduce((sum, r) => sum + Number(r.amountPaid), 0),
      slots: rows.map((r) => ({ id: r.id, startsAt: r.startsAt, endsAt: r.endsAt, quantity: r.quantity })),
    });
  }

  // Upcoming orders first, soonest start first - the most actionable
  // information; past orders after, most recently finished first.
  const upcoming = orders
    .filter((o) => o.status === "upcoming")
    .sort((a, b) => a.slots[0].startsAt.getTime() - b.slots[0].startsAt.getTime());
  const past = orders
    .filter((o) => o.status === "past")
    .sort((a, b) => b.slots[0].startsAt.getTime() - a.slots[0].startsAt.getTime());
  return [...upcoming, ...past];
});
