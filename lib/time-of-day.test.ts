import { describe, expect, it } from "vitest";
import { isSameDayBookingClosed, SAME_DAY_CUTOFF_BUFFER_MINUTES } from "@/lib/time-of-day";

const SYDNEY = "Australia/Sydney";

describe("isSameDayBookingClosed", () => {
  it("closes an hour before closing time, on the venue's clock", () => {
    expect(SAME_DAY_CUTOFF_BUFFER_MINUTES).toBe(60);
    // 20:59 and 21:00 in Sydney (UTC+11 in November), closing at 22:00.
    expect(isSameDayBookingClosed("22:00", SYDNEY, new Date("2026-11-02T09:59:00Z"))).toBe(false);
    expect(isSameDayBookingClosed("22:00", SYDNEY, new Date("2026-11-02T10:00:00Z"))).toBe(true);
  });

  it("reads the time in the venue's timezone, not UTC", () => {
    // 10:00 UTC is 21:00 in Sydney (closed) but 05:00 in New York (open).
    const now = new Date("2026-11-02T10:00:00Z");
    expect(isSameDayBookingClosed("22:00", SYDNEY, now)).toBe(true);
    expect(isSameDayBookingClosed("22:00", "America/New_York", now)).toBe(false);
  });

  it("fails closed when no closing time is set", () => {
    expect(isSameDayBookingClosed(null, SYDNEY, new Date("2026-11-01T22:00:00Z"))).toBe(true);
  });
});
