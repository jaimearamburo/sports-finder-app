import { describe, expect, it } from "vitest";
import { getBreakdownLine, getTotalPrice } from "@/lib/booking-price";
import { toMinorUnits } from "@/lib/stripe";

const START = new Date("2026-11-10T09:00:00Z");
const after = (minutes: number) => new Date(START.getTime() + minutes * 60_000);
const days = (n: number) => after(n * 24 * 60);

describe("getTotalPrice", () => {
  it("charges a court by the hour, including part hours", () => {
    const court = { bookingMechanic: "time_range" as const, pricePerUnit: 20 };
    expect(getTotalPrice(court, [{ startsAt: START, endsAt: after(60) }])).toBe(20);
    expect(getTotalPrice(court, [{ startsAt: START, endsAt: after(90) }])).toBe(30);
  });

  it("charges a pass or stay by the day, summed across separate days", () => {
    const pass = { bookingMechanic: "date_range" as const, pricePerUnit: 15 };
    expect(getTotalPrice(pass, [{ startsAt: START, endsAt: days(3) }])).toBe(45);
    expect(
      getTotalPrice(pass, [
        { startsAt: START, endsAt: days(1) },
        { startsAt: days(4), endsAt: days(5) },
      ])
    ).toBe(30);
  });

  it("charges a class a flat rate whatever its length", () => {
    const yoga = { bookingMechanic: "fixed_session" as const, pricePerUnit: 26.5 };
    expect(getTotalPrice(yoga, [{ startsAt: START, endsAt: after(75) }])).toBe(26.5);
  });

  it("is free for a free listing", () => {
    expect(getTotalPrice({ bookingMechanic: "fixed_session", pricePerUnit: 0 }, [{ startsAt: START, endsAt: after(60) }])).toBe(0);
  });
});

describe("getBreakdownLine", () => {
  it("describes hours, days and nights", () => {
    const slot = [{ startsAt: START, endsAt: after(90) }];
    expect(getBreakdownLine({ bookingMechanic: "time_range", pricePerUnit: 20, isAccommodation: false }, slot)).toBe("1.5 hrs × $20.00");
    const twoDays = [{ startsAt: START, endsAt: days(2) }];
    expect(getBreakdownLine({ bookingMechanic: "date_range", pricePerUnit: 15, isAccommodation: false }, twoDays)).toBe("2 days × $15.00");
    expect(getBreakdownLine({ bookingMechanic: "date_range", pricePerUnit: 40, isAccommodation: true }, twoDays)).toBe("2 nights × $40.00");
  });

  it("has no breakdown for a class", () => {
    expect(getBreakdownLine({ bookingMechanic: "fixed_session", pricePerUnit: 20, isAccommodation: false }, [{ startsAt: START, endsAt: after(60) }])).toBeNull();
  });
});

describe("toMinorUnits", () => {
  it("rounds away floating-point noise", () => {
    expect(toMinorUnits(19.999999)).toBe(2000);
    expect(toMinorUnits(26.5)).toBe(2650);
    expect(toMinorUnits(0.1 + 0.2)).toBe(30);
  });
});
