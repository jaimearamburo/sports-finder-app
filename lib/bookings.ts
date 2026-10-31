import "server-only";
import { prisma } from "@/lib/prisma";
import { getBookableDates, isRequestedSlotValid } from "@/lib/availability";
import { isSlotSetValid } from "@/lib/slot-rules";
import { getTotalPrice } from "@/lib/booking-price";
import { getBookingReference } from "@/lib/booking-reference";
import { withAuth } from "@/lib/auth-guards";
import type { z } from "zod";
import type Stripe from "stripe";
import { getStripe, PAYMENT_CURRENCY, toMinorUnits, PAYMENT_ENV } from "@/lib/stripe";
import {
  confirmPaymentSchema,
  createHoldSchema,
  releaseHoldSchema,
  startPaymentSchema,
} from "@/lib/validation/booking";

export type CreateBookingHoldResult =
  | { ok: true; orderId: string; expiresAt: Date }
  | { ok: false; error: string };

export type ReleaseBookingHoldResult = { ok: true } | { ok: false; error: string };

// Always an array: only a pass (non-accommodation date_range) produces several
// slots, one per picked day. The runtime shape is enforced by createHoldSchema.
type HoldInput = z.infer<typeof createHoldSchema>;

// Returned for input that fails a booking schema. The UI only sends well-formed
// input, so this only reaches crafted requests.
const INVALID_REQUEST = "Invalid booking request.";

// Loads the listing and re-validates every requested slot against it. Expects
// input already parsed by createHoldSchema.
async function loadAndValidateListing(input: HoldInput) {
  const listing = await prisma.listing.findUnique({
    where: { id: input.listingId },
    include: { venue: { include: { city: true } }, activity: true },
  });

  if (!listing || listing.archivedAt) {
    return { ok: false as const, error: "This listing is no longer available." };
  }

  if (!isSlotSetValid(listing, input.slots)) {
    return { ok: false as const, error: "That time is no longer available." };
  }

  const bookableDates = await getBookableDates(listing);
  for (const slot of input.slots) {
    if (!isRequestedSlotValid(listing, slot.startsAt, slot.endsAt, bookableDates)) {
      return { ok: false as const, error: "That time is no longer available." };
    }
  }

  const quantity = input.quantity ?? 1;

  // Server-side limit; the quantity stepper's max is only UX.
  if (listing.maxBookingsPerTransaction !== null && quantity > listing.maxBookingsPerTransaction) {
    return {
      ok: false as const,
      error: `This listing allows at most ${listing.maxBookingsPerTransaction} per booking.`,
    };
  }

  return { ok: true as const, listing, quantity };
}

// Holds every selected slot under one orderId for the duration of checkout.
// This is where capacity is contested, so the race-safety lives here. All slots
// succeed or fail together: a pass missing one of its days isn't a valid
// purchase.
export const createBookingHold = withAuth(
  async (session, rawInput: HoldInput): Promise<CreateBookingHoldResult> => {
    const parsed = createHoldSchema.safeParse(rawInput);
    if (!parsed.success) return { ok: false, error: INVALID_REQUEST };
    const input = parsed.data;

    const validated = await loadAndValidateListing(input);
    if (!validated.ok) return validated;
    const { listing, quantity } = validated;

    const holdMinutes = listing.holdDurationMinutes ?? listing.venue.holdDurationMinutes;
    const expiresAt = new Date(Date.now() + holdMinutes * 60000);
    const orderId = crypto.randomUUID();

    try {
      await prisma.$transaction(async (tx) => {
        // Lock the user's row so concurrent requests from the same user
        // (double-click, two tabs) can't both pass the one-active-hold check.
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${session.user.id} FOR UPDATE`;

        const existingHold = await tx.bookingHold.findFirst({
          where: { userId: session.user.id, expiresAt: { gt: new Date() } },
        });
        if (existingHold) {
          throw new Error("ALREADY_HAS_HOLD");
        }

        // Lock the listing's row so concurrent requests serialise here and each
        // reads an up-to-date capacity sum (under Read Committed, two
        // transactions could otherwise both see "not full").
        await tx.$queryRaw`SELECT id FROM listings WHERE id = ${listing.id} FOR UPDATE`;

        for (const slot of input.slots) {
          // Capacity used by non-cancelled bookings and unexpired holds
          // overlapping this slot. Expired holds are ignored, not deleted.
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

// Appended to every payment outcome that ends without a charge: cards are only
// authorized at checkout and captured once the booking is secured.
const NOT_CHARGED = "You haven't been charged.";

type PriceInfo = Parameters<typeof getTotalPrice>[0];
type OrderHold = { startsAt: Date; endsAt: Date; quantity: number };

// Same calculation as the checkout page total, so the charged amount always
// matches the displayed one.
function getHoldAmount(priceInfo: PriceInfo, hold: OrderHold): number {
  return getTotalPrice(priceInfo, [{ startsAt: hold.startsAt, endsAt: hold.endsAt }]) * hold.quantity;
}

// Accepts the transaction client as well as the plain client.
async function loadPriceInfo(db: Pick<typeof prisma, "listing">, listingId: string): Promise<PriceInfo | null> {
  const listing = await db.listing.findUnique({
    where: { id: listingId },
    select: { pricePerUnit: true, activity: { select: { bookingMechanic: true, isAccommodation: true } } },
  });
  if (!listing) return null;
  return { bookingMechanic: listing.activity.bookingMechanic, pricePerUnit: Number(listing.pricePerUnit) };
}

type Attendee = { attendeeName: string; attendeeEmail: string; attendeePhone?: string };

// How converting an order's holds into bookings ended:
// - created: converted in this call.
// - existing: this same payment already converted them (a retry, or the browser
//   and webhook both completing it).
// - duplicate: a different payment already converted them.
// - expired: the holds are gone or expired.
// - mismatch: the payment amount doesn't match the order's cost.
type ClaimOutcome = "created" | "existing" | "duplicate" | "expired" | "mismatch";

// Atomically converts an order's holds into bookings if they're still valid
// now. Paid orders start "pending" until captured; free orders are confirmed
// immediately. No capacity check: the holds already reserved it, and pending
// bookings still count.
async function claimOrder({
  orderId,
  userId,
  attendee,
  payment,
}: {
  orderId: string;
  userId: string;
  attendee: Attendee;
  // null for a free order.
  payment: { id: string; amount: number; currency: string } | null;
}): Promise<ClaimOutcome> {
  return prisma.$transaction(async (tx) => {
    // The listing to lock comes from the holds, or from the bookings if a
    // previous call already converted them.
    const anchor =
      (await tx.bookingHold.findFirst({ where: { orderId, userId }, select: { listingId: true } })) ??
      (await tx.booking.findFirst({ where: { orderId, userId }, select: { listingId: true } }));
    if (!anchor) return "expired";

    // Same listing lock as createBookingHold. Serialises this against a hold
    // expiring and being re-held, and against the browser and webhook
    // completing the same order: the second caller waits, then finds the
    // bookings.
    await tx.$queryRaw`SELECT id FROM listings WHERE id = ${anchor.listingId} FOR UPDATE`;

    const existing = await tx.booking.findFirst({
      where: { orderId, userId },
      select: { stripePaymentIntentId: true },
    });
    if (existing) {
      return payment && existing.stripePaymentIntentId === payment.id ? "existing" : "duplicate";
    }

    const holds = await tx.bookingHold.findMany({ where: { orderId, userId } });
    const now = new Date();
    if (holds.length === 0 || holds.some((h) => h.expiresAt <= now)) return "expired";

    const priceInfo = await loadPriceInfo(tx, holds[0].listingId);
    if (!priceInfo) return "expired";
    const amounts = holds.map((hold) => getHoldAmount(priceInfo, hold));
    const total = toMinorUnits(amounts.reduce((sum, a) => sum + a, 0));

    // The payment must equal the order's current cost. The amount is fixed at
    // PaymentIntent creation, so this only fails if the price changed
    // mid-checkout or the payment was tampered with.
    if (payment ? payment.amount !== total || payment.currency !== PAYMENT_CURRENCY : total !== 0) {
      return "mismatch";
    }

    await tx.bookingHold.deleteMany({ where: { orderId, userId } });
    await tx.booking.createMany({
      data: holds.map((hold, i) => ({
        orderId,
        listingId: hold.listingId,
        userId,
        startsAt: hold.startsAt,
        endsAt: hold.endsAt,
        quantity: hold.quantity,
        status: payment ? ("pending" as const) : ("confirmed" as const),
        stripePaymentIntentId: payment?.id ?? null,
        amountPaid: amounts[i],
        attendeeName: attendee.attendeeName,
        attendeeEmail: attendee.attendeeEmail,
        attendeePhone: attendee.attendeePhone ?? null,
      })),
    });
    return "created";
  });
}

// Cancels an authorization that will never be captured. Best effort: an
// uncaptured card authorization lapses on its own after about 7 days.
async function releasePayment(paymentIntentId: string) {
  try {
    await getStripe().paymentIntents.cancel(paymentIntentId);
  } catch (error) {
    console.error("Couldn't cancel PaymentIntent", paymentIntentId, error instanceof Error ? error.message : error);
  }
}

// Captures an authorized payment. "in_flight" means Stripe hasn't settled it
// yet; bookings stay pending and the webhook finishes the job.
async function capturePayment(paymentIntent: Stripe.PaymentIntent): Promise<"succeeded" | "failed" | "in_flight"> {
  const stripe = getStripe();
  let status = paymentIntent.status;
  if (status === "requires_capture") {
    try {
      // The idempotency key makes a repeated capture (browser and webhook
      // racing) return the first result instead of capturing twice.
      status = (await stripe.paymentIntents.capture(paymentIntent.id, {}, { idempotencyKey: `capture-${paymentIntent.id}` }))
        .status;
    } catch (error) {
      console.error("Capture failed for", paymentIntent.id, error instanceof Error ? error.message : error);
      status = (await stripe.paymentIntents.retrieve(paymentIntent.id)).status;
    }
  }
  if (status === "succeeded") return "succeeded";
  if (status === "canceled" || status === "requires_payment_method") return "failed";
  return "in_flight";
}

export type StartHoldPaymentResult =
  | { ok: true; clientSecret: string }
  // A free order needs no payment and is confirmed immediately.
  | { ok: true; free: true; orderId: string }
  | { ok: false; error: string };

export type CompletePaymentResult = { ok: true; orderId: string } | { ok: false; error: string };

// Payment step one: validates the attendee and hold, then creates a
// PaymentIntent for the order's exact cost. The browser authorizes the card;
// completeOrderPayment decides whether to capture.
//
// Manual capture keeps the hold honest: money is taken only after the server
// confirms, under the listing lock, that the hold is still valid. Attendee
// details go in the metadata so the webhook can finish the booking without the
// browser.
export const startHoldPayment = withAuth(
  async (session, rawInput: z.input<typeof startPaymentSchema>): Promise<StartHoldPaymentResult> => {
    // Field errors get their own message; a malformed orderId can only come
    // from a crafted request.
    const parsed = startPaymentSchema.safeParse(rawInput);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return {
        ok: false,
        error: issue.path[0] === "orderId" ? "This booking hold could not be found." : issue.message,
      };
    }
    const { orderId, ...attendee } = parsed.data;

    const holds = await prisma.bookingHold.findMany({
      where: { orderId, userId: session.user.id },
      include: { listing: { select: { name: true } } },
    });
    if (holds.length === 0) return { ok: false, error: "This booking hold could not be found." };
    if (holds.some((h) => h.expiresAt <= new Date())) return { ok: false, error: "Your hold has expired." };

    const priceInfo = await loadPriceInfo(prisma, holds[0].listingId);
    if (!priceInfo) return { ok: false, error: "This booking hold could not be found." };
    const amount = toMinorUnits(holds.reduce((sum, hold) => sum + getHoldAmount(priceInfo, hold), 0));

    // Free orders skip Stripe, which can't take a zero payment.
    if (amount === 0) {
      const outcome = await claimOrder({ orderId, userId: session.user.id, attendee, payment: null });
      if (outcome === "created" || outcome === "existing") return { ok: true, free: true, orderId };
      return { ok: false, error: "Your hold has expired." };
    }

    // Stripe's minimum charge is about 50 cents; this only guards against bad
    // listing data.
    if (amount < 50) return { ok: false, error: "This booking can't be paid for online." };

    const paymentIntent = await getStripe().paymentIntents.create({
      amount,
      currency: PAYMENT_CURRENCY,
      capture_method: "manual",
      // Cards only: a redirect-based method would take the customer off the
      // page mid-hold.
      allowed_payment_method_types: ["card"],
      description: `${holds[0].listing.name} (booking ${getBookingReference(orderId)})`,
      metadata: {
        // The webhook only completes payments from its own environment (see
        // PAYMENT_ENV).
        env: PAYMENT_ENV,
        orderId,
        userId: session.user.id,
        attendeeName: attendee.attendeeName,
        attendeeEmail: attendee.attendeeEmail,
        attendeePhone: attendee.attendeePhone ?? "",
      },
    });
    if (!paymentIntent.client_secret) return { ok: false, error: "Payment couldn't be started. Try again." };
    return { ok: true, clientSecret: paymentIntent.client_secret };
  }
);

// Payment step two, shared by the browser (confirmHoldPayment) and the Stripe
// webhook; whichever arrives first does the work. Not wrapped in withAuth
// because the webhook has no session: callers must verify the PaymentIntent
// first (ownership in the browser, Stripe's signature in the webhook).
//
// Claims the holds as pending bookings under the listing lock, captures outside
// the transaction (no network call under a row lock), then confirms. A failed
// claim releases the authorization.
export async function completeOrderPayment(paymentIntent: Stripe.PaymentIntent): Promise<CompletePaymentResult> {
  const { orderId, userId, attendeeName, attendeeEmail, attendeePhone } = paymentIntent.metadata;
  if (!orderId || !userId || !attendeeName || !attendeeEmail) {
    return { ok: false, error: "This payment could not be matched to a booking." };
  }
  if (paymentIntent.status !== "requires_capture" && paymentIntent.status !== "succeeded") {
    return { ok: false, error: `Your payment wasn't completed. ${NOT_CHARGED}` };
  }

  const outcome = await claimOrder({
    orderId,
    userId,
    attendee: { attendeeName, attendeeEmail, attendeePhone: attendeePhone || undefined },
    payment: { id: paymentIntent.id, amount: paymentIntent.amount, currency: paymentIntent.currency },
  });

  if (outcome === "expired" || outcome === "duplicate" || outcome === "mismatch") {
    await releasePayment(paymentIntent.id);
    return {
      ok: false,
      error:
        outcome === "expired"
          ? `Your hold expired before the payment went through. ${NOT_CHARGED}`
          : `This payment couldn't be applied to your booking. ${NOT_CHARGED}`,
    };
  }

  const captured = await capturePayment(paymentIntent);
  if (captured === "succeeded") {
    await prisma.booking.updateMany({
      where: { stripePaymentIntentId: paymentIntent.id, status: "pending" },
      data: { status: "confirmed" },
    });
    return { ok: true, orderId };
  }
  if (captured === "failed") {
    // Cancelled bookings don't count against capacity, so this frees the slot.
    await prisma.booking.updateMany({
      where: { stripePaymentIntentId: paymentIntent.id, status: "pending" },
      data: { status: "cancelled" },
    });
    return { ok: false, error: `Your payment couldn't be completed. ${NOT_CHARGED}` };
  }
  // Still settling: the confirmation page shows it as processing until the
  // webhook confirms it.
  return { ok: true, orderId };
}

// Browser side of step two. The PaymentIntent id comes from the client, so it's
// re-fetched from Stripe and must belong to this user and order.
export const confirmHoldPayment = withAuth(
  async (session, rawInput: z.input<typeof confirmPaymentSchema>): Promise<CompletePaymentResult> => {
    const parsed = confirmPaymentSchema.safeParse(rawInput);
    if (!parsed.success) return { ok: false, error: "This payment could not be matched to your booking." };
    const { orderId, paymentIntentId } = parsed.data;

    let paymentIntent: Stripe.PaymentIntent;
    try {
      paymentIntent = await getStripe().paymentIntents.retrieve(paymentIntentId);
    } catch {
      return { ok: false, error: "This payment could not be matched to your booking." };
    }
    if (paymentIntent.metadata.userId !== session.user.id || paymentIntent.metadata.orderId !== orderId) {
      return { ok: false, error: "This payment could not be matched to your booking." };
    }
    return completeOrderPayment(paymentIntent);
  }
);

// Releases an order's holds early (the active-hold banner's Cancel). Scoped to
// the session's user, so it can't release anyone else's hold. Succeeds as a
// no-op when the holds are already gone.
export const releaseBookingHold = withAuth(
  async (session, rawInput: { orderId: string }): Promise<ReleaseBookingHoldResult> => {
    const parsed = releaseHoldSchema.safeParse(rawInput);
    if (!parsed.success) return { ok: false, error: INVALID_REQUEST };
    const input = parsed.data;

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
  // Needed to format the order's dates (see formatBookingTime).
  bookingMechanic: "time_range" | "date_range" | "fixed_session";
  isAccommodation: boolean;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone: string | null;
  totalAmountPaid: number;
  slots: BookingOrderSlot[];
};

// Every order (Booking rows sharing an orderId) the signed-in user has made,
// for My Bookings. An order is "upcoming" until its latest slot has ended, so a
// pass stays upcoming until its last day.
export const getUserBookingOrders = withAuth(async (session): Promise<BookingOrder[]> => {
  // Cancelled bookings are left out: today that only means a failed capture,
  // which was never charged or held.
  const bookings = await prisma.booking.findMany({
    where: { userId: session.user.id, status: { not: "cancelled" } },
    include: { listing: { include: { venue: { include: { city: true } }, activity: true } } },
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
      bookingMechanic: first.listing.activity.bookingMechanic,
      isAccommodation: first.listing.activity.isAccommodation,
      attendeeName: first.attendeeName,
      attendeeEmail: first.attendeeEmail,
      attendeePhone: first.attendeePhone,
      totalAmountPaid: rows.reduce((sum, r) => sum + Number(r.amountPaid), 0),
      slots: rows.map((r) => ({ id: r.id, startsAt: r.startsAt, endsAt: r.endsAt, quantity: r.quantity })),
    });
  }

  // Upcoming first, soonest first; then past, most recent first.
  const upcoming = orders
    .filter((o) => o.status === "upcoming")
    .sort((a, b) => a.slots[0].startsAt.getTime() - b.slots[0].startsAt.getTime());
  const past = orders
    .filter((o) => o.status === "past")
    .sort((a, b) => b.slots[0].startsAt.getTime() - a.slots[0].startsAt.getTime());
  return [...upcoming, ...past];
});
