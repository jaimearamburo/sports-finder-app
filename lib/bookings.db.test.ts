import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { addDays, todayInTimezone } from "@/lib/dates";
import { zonedOccurrenceStart } from "@/lib/time-of-day";

// The booking core against a real Postgres: holds, the row locks that prevent
// double-booking, and completing paid orders. These call the real DAL
// functions, with two substitutes:
// - auth(): needs a Next.js request. Each call runs as a test user through
//   AsyncLocalStorage, so concurrent calls can be different users.
// - Stripe: a fake client recording captures and cancellations.

// vi.hoisted runs before the imports, so it imports what it needs itself.
const { sessions, stripe } = await vi.hoisted(async () => ({
  sessions: new (await import("node:async_hooks")).AsyncLocalStorage<Session>(),
  stripe: {
    paymentIntents: {
      capture: vi.fn(),
      cancel: vi.fn(),
      retrieve: vi.fn(),
      create: vi.fn(),
    },
  },
}));
vi.mock("@/auth", () => ({ auth: async () => sessions.getStore() ?? null }));
vi.mock("@/lib/stripe", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/stripe")>()),
  getStripe: () => stripe,
}));

const { createBookingHold, completeOrderPayment } = await import("@/lib/bookings");

const TIME_ZONE = "Australia/Sydney";
const PREFIX = `dbtest-${crypto.randomUUID().slice(0, 8)}`;
const ATTENDEE = { attendeeName: "DB Test Attendee", attendeeEmail: "dbtest-attendee@example.com", attendeePhone: "" };

let users: { id: string }[] = [];
let courtId: string;
let fixtureIds: { countryId: string; cityId: string; activityId: string; venueId: string };

function as<T>(user: { id: string }, fn: () => Promise<T>): Promise<T> {
  const session = { user: { id: user.id, role: "user", name: "DB Test", email: `${user.id}@example.com` }, expires: "" };
  return sessions.run(session as unknown as Session, fn);
}

// A court slot tomorrow, venue time. The court is open 08:00-20:00 with
// 30-minute steps and 60-120 minute bookings, $20 an hour.
function courtSlot(time = "10:00", minutes = 60) {
  const startsAt = zonedOccurrenceStart(addDays(todayInTimezone(TIME_ZONE), 1), time, TIME_ZONE);
  return { startsAt, endsAt: new Date(startsAt.getTime() + minutes * 60_000) };
}

function holdCourt(user: { id: string }, slot = courtSlot()) {
  return as(user, () => createBookingHold({ listingId: courtId, slots: [slot] }));
}

async function heldOrder(user: { id: string }): Promise<string> {
  const result = await holdCourt(user);
  if (!result.ok || !("orderId" in result)) throw new Error(`Hold failed: ${"error" in result ? result.error : ""}`);
  return result.orderId;
}

// The PaymentIntent Stripe would hand back once the card is authorized.
function paymentIntent(orderId: string, userId: string, overrides: Partial<Stripe.PaymentIntent> = {}): Stripe.PaymentIntent {
  return {
    id: `pi_${PREFIX}_${crypto.randomUUID().slice(0, 8)}`,
    status: "requires_capture",
    amount: 2000,
    currency: "aud",
    metadata: { orderId, userId, ...ATTENDEE },
    ...overrides,
  } as Stripe.PaymentIntent;
}

beforeAll(async () => {
  // Creates everything it uses, so it runs on an empty database (as in CI).
  const country = await prisma.country.create({ data: { name: `${PREFIX} Country`, code: PREFIX } });
  const city = await prisma.city.create({ data: { name: `${PREFIX} City`, timezone: TIME_ZONE, countryId: country.id } });
  const activity = await prisma.activity.create({ data: { name: `${PREFIX} Tennis`, bookingMechanic: "time_range" } });
  users = await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      prisma.user.create({ data: { name: `DB Test User ${i}`, email: `${PREFIX}-user${i}@example.com` } })
    )
  );
  const venue = await prisma.venue.create({
    data: { name: `${PREFIX} Venue`, address: "1 Test Street", cityId: city.id, ownerId: users[0].id },
  });
  const court = await prisma.listing.create({
    data: {
      name: `${PREFIX} Court`,
      venueId: venue.id,
      activityId: activity.id,
      capacity: 1,
      maxBookingsPerTransaction: 1,
      pricePerUnit: 20,
      operatingHoursStart: "08:00",
      operatingHoursEnd: "20:00",
      incrementMinutes: 30,
      minDurationMinutes: 60,
      maxDurationMinutes: 120,
    },
  });
  courtId = court.id;
  fixtureIds = { countryId: country.id, cityId: city.id, activityId: activity.id, venueId: venue.id };
});

beforeEach(async () => {
  await prisma.booking.deleteMany({ where: { listingId: courtId } });
  await prisma.bookingHold.deleteMany({ where: { listingId: courtId } });
  vi.clearAllMocks();
  stripe.paymentIntents.capture.mockResolvedValue({ status: "succeeded" });
  stripe.paymentIntents.cancel.mockResolvedValue({ status: "canceled" });
});

afterAll(async () => {
  // Foreign-key order: bookings restrict their listing; the venue cascades to
  // its listings and holds.
  if (courtId) await prisma.booking.deleteMany({ where: { listingId: courtId } });
  if (fixtureIds) {
    await prisma.venue.deleteMany({ where: { id: fixtureIds.venueId } });
    await prisma.activity.deleteMany({ where: { id: fixtureIds.activityId } });
    await prisma.city.deleteMany({ where: { id: fixtureIds.cityId } });
    await prisma.country.deleteMany({ where: { id: fixtureIds.countryId } });
  }
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("createBookingHold", () => {
  it("lets exactly one of several people racing for the last spot win", async () => {
    // Five users request the same capacity-1 slot at once. Without the
    // listing-row lock, several can read "still free" before any commits.
    const results = await Promise.all(users.map((user) => holdCourt(user)));

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    for (const result of results.filter((r) => !r.ok)) {
      expect(result).toEqual({ ok: false, error: "This slot just filled up - try another time." });
    }
    expect(await prisma.bookingHold.count({ where: { listingId: courtId } })).toBe(1);
  });

  it("gives one person one hold, even from two requests at once", async () => {
    // A double-click or two tabs: different slots, same user. Without the
    // user-row lock both can see "no hold yet".
    const results = await Promise.all([holdCourt(users[0], courtSlot("10:00")), holdCourt(users[0], courtSlot("14:00"))]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({
      ok: false,
      error: "You already have a booking in progress. Finish or cancel it first.",
    });
    expect(await prisma.bookingHold.count({ where: { userId: users[0].id } })).toBe(1);
  });

  it("refuses a slot that overlaps an existing booking", async () => {
    await prisma.booking.create({
      data: {
        orderId: crypto.randomUUID(),
        listingId: courtId,
        userId: users[1].id,
        ...courtSlot("09:30", 60),
        status: "confirmed",
        ...ATTENDEE,
      },
    });
    expect(await holdCourt(users[0], courtSlot("10:00"))).toMatchObject({ ok: false });
    expect(await holdCourt(users[0], courtSlot("10:30"))).toMatchObject({ ok: true });
  });

  it("doesn't count an expired hold or a cancelled booking", async () => {
    const slot = courtSlot();
    await prisma.bookingHold.create({
      data: { orderId: crypto.randomUUID(), listingId: courtId, userId: users[1].id, ...slot, expiresAt: new Date(Date.now() - 1000) },
    });
    await prisma.booking.create({
      data: { orderId: crypto.randomUUID(), listingId: courtId, userId: users[2].id, ...slot, status: "cancelled", ...ATTENDEE },
    });
    expect(await holdCourt(users[0], slot)).toMatchObject({ ok: true });
  });

  it("refuses a request the picker could never send", async () => {
    const offStep = courtSlot("10:15");
    const twoSlots = [courtSlot("10:00"), courtSlot("14:00")];
    expect(await holdCourt(users[0], offStep)).toMatchObject({ ok: false });
    expect(await as(users[0], () => createBookingHold({ listingId: courtId, slots: twoSlots }))).toMatchObject({ ok: false });
    expect(await as(users[0], () => createBookingHold({ listingId: courtId, slots: [courtSlot()], quantity: 2 }))).toMatchObject({
      ok: false,
    });
    expect(await prisma.bookingHold.count({ where: { listingId: courtId } })).toBe(0);
  });

  it("refuses a signed-out visitor", async () => {
    expect(await createBookingHold({ listingId: courtId, slots: [courtSlot()] })).toMatchObject({ ok: false, signedOut: true });
  });
});

describe("completeOrderPayment", () => {
  it("books the order once when the browser and the webhook both complete it", async () => {
    const orderId = await heldOrder(users[0]);
    const pi = paymentIntent(orderId, users[0].id);

    const results = await Promise.all([completeOrderPayment(pi), completeOrderPayment(pi)]);

    expect(results).toEqual([
      { ok: true, orderId },
      { ok: true, orderId },
    ]);
    const bookings = await prisma.booking.findMany({ where: { orderId } });
    expect(bookings).toHaveLength(1);
    expect(bookings[0]).toMatchObject({ status: "confirmed", stripePaymentIntentId: pi.id, attendeeName: ATTENDEE.attendeeName });
    expect(Number(bookings[0].amountPaid)).toBe(20);
    expect(await prisma.bookingHold.count({ where: { orderId } })).toBe(0);
    // Both callers may capture, always with the same idempotency key, so Stripe
    // captures once.
    for (const call of stripe.paymentIntents.capture.mock.calls) {
      expect(call[0]).toBe(pi.id);
      expect(call[2]).toEqual({ idempotencyKey: `capture-${pi.id}` });
    }
    expect(stripe.paymentIntents.cancel).not.toHaveBeenCalled();
  });

  it("releases the payment and books nothing when the hold expired first", async () => {
    const orderId = await heldOrder(users[0]);
    await prisma.bookingHold.updateMany({ where: { orderId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const pi = paymentIntent(orderId, users[0].id);

    const result = await completeOrderPayment(pi);

    expect(result).toEqual({
      ok: false,
      error: "Your hold expired before the payment went through. You haven't been charged.",
    });
    expect(stripe.paymentIntents.cancel).toHaveBeenCalledWith(pi.id);
    expect(stripe.paymentIntents.capture).not.toHaveBeenCalled();
    expect(await prisma.booking.count({ where: { orderId } })).toBe(0);
  });

  it("releases a payment for the wrong amount", async () => {
    const orderId = await heldOrder(users[0]);
    const pi = paymentIntent(orderId, users[0].id, { amount: 1000 });

    expect(await completeOrderPayment(pi)).toMatchObject({ ok: false });
    expect(stripe.paymentIntents.cancel).toHaveBeenCalledWith(pi.id);
    expect(await prisma.booking.count({ where: { orderId } })).toBe(0);
  });

  it("releases a second, different payment for an order already paid", async () => {
    const orderId = await heldOrder(users[0]);
    const first = paymentIntent(orderId, users[0].id);
    const second = paymentIntent(orderId, users[0].id);
    await completeOrderPayment(first);

    expect(await completeOrderPayment(second)).toMatchObject({ ok: false });
    expect(stripe.paymentIntents.cancel).toHaveBeenCalledWith(second.id);
    expect(await prisma.booking.count({ where: { orderId } })).toBe(1);
  });

  it("cancels the booking and frees the slot when the capture fails", async () => {
    const orderId = await heldOrder(users[0]);
    stripe.paymentIntents.capture.mockRejectedValue(new Error("card declined"));
    stripe.paymentIntents.retrieve.mockResolvedValue({ status: "canceled" });

    const result = await completeOrderPayment(paymentIntent(orderId, users[0].id));

    expect(result).toEqual({ ok: false, error: "Your payment couldn't be completed. You haven't been charged." });
    expect((await prisma.booking.findFirstOrThrow({ where: { orderId } })).status).toBe("cancelled");
    expect(await holdCourt(users[1])).toMatchObject({ ok: true });
  });

  it("keeps the booking pending while the capture is still settling", async () => {
    const orderId = await heldOrder(users[0]);
    stripe.paymentIntents.capture.mockResolvedValue({ status: "processing" });

    expect(await completeOrderPayment(paymentIntent(orderId, users[0].id))).toEqual({ ok: true, orderId });
    expect((await prisma.booking.findFirstOrThrow({ where: { orderId } })).status).toBe("pending");
    // A pending booking still holds the slot.
    expect(await holdCourt(users[1])).toMatchObject({ ok: false });
  });
});
