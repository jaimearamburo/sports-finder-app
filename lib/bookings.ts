import "server-only";
import { prisma } from "@/lib/prisma";
import { getBookableDates, isRequestedSlotValid } from "@/lib/availability";
import { isSlotSetValid } from "@/lib/slot-rules";
import { getTotalPrice } from "@/lib/booking-price";
import { getBookingReference } from "@/lib/booking-reference";
import { withAuth } from "@/lib/auth-guards";
import type { z } from "zod";
import type Stripe from "stripe";
import { getStripe, PAYMENT_CURRENCY, toMinorUnits } from "@/lib/stripe";
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

// slots is always an array, even though time_range, fixed_session, and an
// accommodation date_range always produce exactly one entry - only a
// non-accommodation date_range "pass" (several individually-picked days,
// e.g. the 19th/23rd/30th) ever produces more than one. Keeping this plural
// everywhere avoids a separate single-slot code path that the multi-day
// case would otherwise have to awkwardly bypass. This is the *declared*
// argument type only - the runtime shape is enforced by createHoldSchema.
type HoldInput = z.infer<typeof createHoldSchema>;

// Shown for any input that fails a booking schema. Never reached by the
// real UI (the pickers and checkout form only ever send well-formed
// input), so it doesn't need to say which field was wrong - only a
// hand-crafted request gets here.
const INVALID_REQUEST = "Invalid booking request.";

// Fetches the listing and re-validates every requested slot against it,
// shared by createBookingHold so the hold step and the picker UI it
// follows can never silently disagree on what counts as a legal request.
// Expects input that has already passed createHoldSchema.
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

  // Already a positive integer when present (createHoldSchema).
  const quantity = input.quantity ?? 1;

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

// Shown with every payment outcome that ends without a charge. Cards are
// only authorized at checkout and captured once the booking is secured
// (see completeOrderPayment), so a failed or late payment never costs the
// customer anything - and they should be told so.
const NOT_CHARGED = "You haven't been charged.";

type PriceInfo = Parameters<typeof getTotalPrice>[0];
type OrderHold = { startsAt: Date; endsAt: Date; quantity: number };

// What one hold costs - the same calculation the checkout page shows as its
// total, so the amount charged can never drift from the amount displayed.
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

// How an attempt to turn an order's holds into bookings ended.
// - created: holds converted into bookings in this call.
// - existing: this same payment already converted them (a retry, or the
//   webhook and the browser both completing the same payment).
// - duplicate: a different payment already converted them.
// - expired: the holds are gone or past their expiry.
// - mismatch: the payment's amount isn't what the order costs.
type ClaimOutcome = "created" | "existing" | "duplicate" | "expired" | "mismatch";

// Converts every hold in an order into Booking rows, atomically, if and
// only if the holds are still valid at this exact moment. Shared by paid
// orders (bookings start "pending" until the card is captured) and free
// ones (confirmed straight away, no payment). Capacity-neutral: the holds
// already reserved this capacity, and "pending" bookings still count
// against it, so no capacity check is repeated here.
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

    // The same listing-row lock createBookingHold takes. It serialises this
    // against a hold expiring and being handed to someone else at the same
    // instant, and against the browser and the payment webhook completing
    // the same order at once - whichever arrives second waits here, then
    // sees the bookings the first one created.
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

    // A payment must cover exactly what the order costs now. The amount
    // was fixed when the PaymentIntent was created, so this only fails if
    // the price changed mid-checkout or the payment was tampered with.
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
        // "pending" until the card is captured - the asynchronous gap this
        // status exists for. A free order has nothing to wait for.
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

// Releases an authorization that will never be captured, so the customer's
// bank drops the pending amount. Best effort: if it fails, the bank drops
// it anyway once the authorization expires (about 7 days for cards).
async function releasePayment(paymentIntentId: string) {
  try {
    await getStripe().paymentIntents.cancel(paymentIntentId);
  } catch (error) {
    console.error("Couldn't cancel PaymentIntent", paymentIntentId, error instanceof Error ? error.message : error);
  }
}

// Captures an authorized payment and reports where it ended up. "in_flight"
// means Stripe hasn't settled it either way yet (e.g. another request is
// capturing it right now) - the bookings stay "pending" and the webhook
// finishes the job.
async function capturePayment(paymentIntent: Stripe.PaymentIntent): Promise<"succeeded" | "failed" | "in_flight"> {
  const stripe = getStripe();
  let status = paymentIntent.status;
  if (status === "requires_capture") {
    try {
      // The idempotency key makes a repeat capture (browser and webhook
      // racing) return the first capture's result, not capture twice.
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
  // A free order needs no payment and is confirmed straight away.
  | { ok: true; free: true; orderId: string }
  | { ok: false; error: string };

export type CompletePaymentResult = { ok: true; orderId: string } | { ok: false; error: string };

// Step one of paying: validates the attendee details and the hold, then
// creates a Stripe PaymentIntent for exactly what the order costs. The card
// is then authorized in the browser by the Payment Element, and
// completeOrderPayment decides whether to capture it.
//
// capture_method "manual" is what keeps the 5-minute hold honest: the card
// is only authorized here, and the money is taken only once the server has
// confirmed - under the listing lock - that the hold is still valid. A
// payment that arrives after the hold expired is released, never charged.
// The attendee details travel in the PaymentIntent's metadata so the
// webhook can finish the booking even if the browser never returns.
export const startHoldPayment = withAuth(
  async (session, rawInput: z.input<typeof startPaymentSchema>): Promise<StartHoldPaymentResult> => {
    // Same error handling as attendee validation everywhere else: a field
    // error is a real (if client-bypassing) user mistake and gets its own
    // message; a malformed orderId can only be a crafted request.
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

    // Free listings (e.g. a free group run) skip payment entirely - Stripe
    // can't take a zero payment anyway.
    if (amount === 0) {
      const outcome = await claimOrder({ orderId, userId: session.user.id, attendee, payment: null });
      if (outcome === "created" || outcome === "existing") return { ok: true, free: true, orderId };
      return { ok: false, error: "Your hold has expired." };
    }

    // Stripe's minimum charge is about 50 cents. No listing costs less than
    // a dollar, so this only guards against a data mistake.
    if (amount < 50) return { ok: false, error: "This booking can't be paid for online." };

    const paymentIntent = await getStripe().paymentIntents.create({
      amount,
      currency: PAYMENT_CURRENCY,
      capture_method: "manual",
      // Cards only: no Link, wallets or redirect-based methods. A redirect
      // would take the customer off the page mid-hold, and the checkout
      // only ever needs a card in test mode.
      allowed_payment_method_types: ["card"],
      description: `${holds[0].listing.name} (booking ${getBookingReference(orderId)})`,
      metadata: {
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

// Step two of paying, shared by the browser (confirmHoldPayment, below) and
// the Stripe webhook (app/api/stripe/webhook/route.ts) - whichever arrives
// first does the work, and the other finds it done. Not wrapped in withAuth
// because the webhook has no session: callers must establish that the
// PaymentIntent is genuine first (the browser path checks it belongs to the
// signed-in user; the webhook verifies Stripe's signature).
//
// Order of operations: claim the holds as "pending" bookings under the
// listing lock, then capture the card outside the transaction (a network
// call shouldn't hold a row lock), then mark the bookings confirmed. If the
// claim fails, the authorization is released and nothing is charged.
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
    // Frees the capacity again - cancelled bookings don't count against it.
    await prisma.booking.updateMany({
      where: { stripePaymentIntentId: paymentIntent.id, status: "pending" },
      data: { status: "cancelled" },
    });
    return { ok: false, error: `Your payment couldn't be completed. ${NOT_CHARGED}` };
  }
  // Still settling: the confirmation page shows it as processing, and the
  // webhook confirms it once Stripe reports the capture.
  return { ok: true, orderId };
}

// The browser's half of step two, called once the Payment Element has
// authorized the card. The PaymentIntent id comes from the client, so it's
// re-fetched from Stripe (never trusted as sent) and must belong to this
// user and this order before anything is done with it.
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

// Explicitly releases an order's holds before they expire on their own -
// e.g. the checkout page's "Back to listing" action, or the active-hold
// banner's "Cancel" button. Ownership-scoped: deleteMany's where clause
// only ever matches rows that are both in this order and owned by this
// session's user, so it can't be used to release someone else's hold.
// No-op (still ok: true) if the holds are already gone - already
// finalized or already expired holds have nothing left to release, and
// the caller is moving on regardless.
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
  // Needed to format the order's dates correctly - see formatBookingTime.
  bookingMechanic: "time_range" | "date_range" | "fixed_session";
  isAccommodation: boolean;
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
  // Cancelled bookings are left out: today the only way a booking becomes
  // cancelled is a payment that failed at capture, which the customer was
  // never charged for and never really had. Revisit when customers can
  // cancel their own bookings (that history should probably show).
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
