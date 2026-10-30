import { describe, expect, it } from "vitest";
import { assessListingImpact, bookingFits, peakConcurrentQuantity, type ImpactBooking } from "@/lib/dashboard/listing-impact";
import type { ParsedListing } from "@/lib/validation/listing";

const shared = { activityId: "a", name: "x", description: null, imageUrl: null, price: 20, maxPerBooking: 1 };
const court: ParsedListing = {
  kind: "court",
  ...shared,
  capacity: 1,
  openingTime: "08:00",
  closingTime: "22:00",
  startStepMinutes: 30,
  minDurationMinutes: 60,
  maxDurationMinutes: 120,
};
const SYDNEY = "Australia/Sydney";

// 10:00-11:00 Sydney on Sat 31 Oct 2026 (UTC+11).
const booking = (start: string, end: string, orderId = "o1", quantity = 1): ImpactBooking => ({
  orderId,
  quantity,
  startsAt: new Date(start),
  endsAt: new Date(end),
});
const tenToEleven = booking("2026-10-30T23:00:00Z", "2026-10-31T00:00:00Z");

describe("bookingFits: courts", () => {
  it("accepts a booking inside the hours and limits", () => {
    expect(bookingFits(tenToEleven, court, SYDNEY)).toBe(true);
  });

  it("flags a booking outside new opening hours", () => {
    expect(bookingFits(tenToEleven, { ...court, openingTime: "12:00" }, SYDNEY)).toBe(false);
    expect(bookingFits(tenToEleven, { ...court, closingTime: "10:30" }, SYDNEY)).toBe(false);
  });

  it("flags a booking shorter or longer than the new limits", () => {
    expect(bookingFits(tenToEleven, { ...court, minDurationMinutes: 90 }, SYDNEY)).toBe(false);
    expect(bookingFits(tenToEleven, { ...court, maxDurationMinutes: 30, minDurationMinutes: 30 }, SYDNEY)).toBe(false);
  });

  it("flags a start that's off the new step", () => {
    const tenThirty = booking("2026-10-30T23:30:00Z", "2026-10-31T00:30:00Z");
    expect(bookingFits(tenThirty, court, SYDNEY)).toBe(true);
    expect(bookingFits(tenThirty, { ...court, startStepMinutes: 60 }, SYDNEY)).toBe(false);
  });
});

describe("bookingFits: classes and stays", () => {
  const monday6pm: ParsedListing = { kind: "class", ...shared, capacity: 20, weekday: 1, startTime: "18:00", sessionMinutes: 45 };
  // Mon 2 Nov 2026, 6pm Sydney = 07:00Z.
  const session = booking("2026-11-02T07:00:00Z", "2026-11-02T07:45:00Z");

  it("matches a class on its weekday, time and length", () => {
    expect(bookingFits(session, monday6pm, SYDNEY)).toBe(true);
    expect(bookingFits(session, { ...monday6pm, weekday: 2 }, SYDNEY)).toBe(false);
    expect(bookingFits(session, { ...monday6pm, startTime: "18:30" }, SYDNEY)).toBe(false);
    expect(bookingFits(session, { ...monday6pm, sessionMinutes: 60 }, SYDNEY)).toBe(false);
  });

  it("checks a stay's number of nights", () => {
    const stay: ParsedListing = { kind: "stay", ...shared, capacity: 1, closingTime: "20:00", minDays: 1, maxDays: 7 };
    const threeNights = booking("2026-11-01T00:00:00Z", "2026-11-04T00:00:00Z");
    expect(bookingFits(threeNights, stay, SYDNEY)).toBe(true);
    expect(bookingFits(threeNights, { ...stay, maxDays: 2 }, SYDNEY)).toBe(false);
  });
});

describe("peakConcurrentQuantity", () => {
  it("adds up overlapping bookings but not back-to-back ones", () => {
    const a = booking("2026-11-01T00:00:00Z", "2026-11-01T02:00:00Z", "a", 2);
    const b = booking("2026-11-01T01:00:00Z", "2026-11-01T03:00:00Z", "b", 3);
    const c = booking("2026-11-01T03:00:00Z", "2026-11-01T04:00:00Z", "c", 4);
    expect(peakConcurrentQuantity([a, b, c])).toBe(5);
    expect(peakConcurrentQuantity([])).toBe(0);
  });
});

describe("assessListingImpact", () => {
  it("counts affected orders and capacity overruns", () => {
    const pass: ParsedListing = { kind: "pass", ...shared, capacity: 2, openingTime: "06:00", closingTime: "22:00", minDays: 1, maxDays: 2 };
    const day = (d: string, orderId: string, quantity = 1) => booking(`2026-11-${d}T00:00:00Z`, `2026-11-${String(Number(d) + 1).padStart(2, "0")}T00:00:00Z`, orderId, quantity);
    const bookings = [day("01", "three-days"), day("02", "three-days"), day("03", "three-days"), day("02", "pair", 2)];
    expect(assessListingImpact(bookings, pass, SYDNEY)).toEqual({ ordersOutsideSchedule: 1, peakOverCapacity: 3 });
    expect(assessListingImpact(bookings, { ...pass, maxDays: 3, capacity: null }, SYDNEY)).toEqual({ ordersOutsideSchedule: 0, peakOverCapacity: null });
  });
});
