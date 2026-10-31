import { describe, expect, it } from "vitest";
import { isSlotSetValid } from "@/lib/slot-rules";
import { addDays } from "@/lib/dates";

const DAY = new Date("2026-11-10T00:00:00Z");
const oneDay = (offset: number) => ({ startsAt: addDays(DAY, offset), endsAt: addDays(DAY, offset + 1) });

const court = { minDurationDays: null, maxDurationDays: null, activity: { bookingMechanic: "time_range" as const, isAccommodation: false } };
const yoga = { ...court, activity: { bookingMechanic: "fixed_session" as const, isAccommodation: false } };
const stay = { minDurationDays: 1, maxDurationDays: 7, activity: { bookingMechanic: "date_range" as const, isAccommodation: true } };
const pass = { minDurationDays: 1, maxDurationDays: 5, activity: { bookingMechanic: "date_range" as const, isAccommodation: false } };

describe("isSlotSetValid", () => {
  it("allows exactly one slot for a court, a class or a stay", () => {
    const slot = { startsAt: new Date("2026-11-10T00:00:00Z"), endsAt: new Date("2026-11-10T01:00:00Z") };
    for (const listing of [court, yoga, stay]) {
      expect(isSlotSetValid(listing, [slot])).toBe(true);
      expect(isSlotSetValid(listing, [slot, slot])).toBe(false);
      expect(isSlotSetValid(listing, [])).toBe(false);
    }
  });

  it("allows a pass any number of separate days within its bounds", () => {
    expect(isSlotSetValid(pass, [oneDay(0)])).toBe(true);
    expect(isSlotSetValid(pass, [oneDay(0), oneDay(4), oneDay(9)])).toBe(true);
    expect(isSlotSetValid(pass, [0, 1, 2, 3, 4].map(oneDay))).toBe(true);
  });

  it("rejects a pass with more days than allowed", () => {
    expect(isSlotSetValid(pass, [0, 1, 2, 3, 4, 5].map(oneDay))).toBe(false);
  });

  it("rejects a pass with fewer days than required", () => {
    expect(isSlotSetValid({ ...pass, minDurationDays: 3 }, [oneDay(0), oneDay(1)])).toBe(false);
  });

  it("rejects the same day picked twice", () => {
    expect(isSlotSetValid(pass, [oneDay(2), oneDay(2)])).toBe(false);
  });

  it("rejects a pass slot that isn't exactly one day", () => {
    expect(isSlotSetValid(pass, [{ startsAt: DAY, endsAt: addDays(DAY, 2) }])).toBe(false);
  });

  it("treats a pass with no bounds as one day only", () => {
    const loose = { ...pass, minDurationDays: null, maxDurationDays: null };
    expect(isSlotSetValid(loose, [oneDay(0)])).toBe(true);
    expect(isSlotSetValid(loose, [oneDay(0), oneDay(1)])).toBe(false);
  });
});
