import { afterEach, describe, expect, it, vi } from "vitest";
import { bookingDays, dayKey, isUpcomingBooking } from "@/lib/dashboard/booking-days";

afterEach(() => vi.useRealTimers());

describe("dayKey", () => {
  it("reads the calendar day on the given timezone's clock", () => {
    const instant = new Date("2026-10-30T20:00:00Z"); // 7am 31 Oct in Sydney, 4pm 30 Oct in New York
    expect(dayKey(instant, "Australia/Sydney")).toBe("2026-10-31");
    expect(dayKey(instant, "America/New_York")).toBe("2026-10-30");
  });
});

describe("bookingDays", () => {
  it("reads a court booking on the venue's clock", () => {
    const court = { startsAt: new Date("2026-10-30T22:00:00Z"), endsAt: new Date("2026-10-30T23:00:00Z") };
    expect(bookingDays(court, "Australia/Sydney", "time_range")).toEqual({ first: "2026-10-31", last: "2026-10-31" });
  });

  it("reads a pass as UTC calendar days with an exclusive end", () => {
    // A two-day pass for 30 and 31 Oct: stored as 30 Oct 00:00Z to 1 Nov 00:00Z.
    const pass = { startsAt: new Date("2026-10-30T00:00:00Z"), endsAt: new Date("2026-11-01T00:00:00Z") };
    expect(bookingDays(pass, "America/New_York", "date_range")).toEqual({ first: "2026-10-30", last: "2026-10-31" });
  });
});

describe("isUpcomingBooking", () => {
  it("treats a court booking as finished once its end time passes", () => {
    const now = new Date("2026-10-30T12:00:00Z");
    const court = { startsAt: new Date("2026-10-30T10:00:00Z"), endsAt: new Date("2026-10-30T11:00:00Z") };
    expect(isUpcomingBooking(court, "Australia/Sydney", "time_range", now)).toBe(false);
    expect(isUpcomingBooking({ ...court, endsAt: new Date("2026-10-30T13:00:00Z") }, "Australia/Sydney", "time_range", now)).toBe(true);
  });

  it("keeps today's pass at a venue ahead of UTC until the venue's day is over", () => {
    // 2pm 31 Oct in Sydney. A one-day pass for 31 Oct is stored as 31 Oct
    // 00:00Z to 1 Nov 00:00Z - still running on the venue's clock.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-31T03:00:00Z"));
    const pass = { startsAt: new Date("2026-10-31T00:00:00Z"), endsAt: new Date("2026-11-01T00:00:00Z") };
    expect(isUpcomingBooking(pass, "Australia/Sydney", "date_range", new Date())).toBe(true);
    const yesterdaysPass = { startsAt: new Date("2026-10-30T00:00:00Z"), endsAt: new Date("2026-10-31T00:00:00Z") };
    expect(isUpcomingBooking(yesterdaysPass, "Australia/Sydney", "date_range", new Date())).toBe(false);
  });
});
