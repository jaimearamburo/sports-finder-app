import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AvailabilityOverride } from "../generated/prisma/client";
import { addDays } from "@/lib/dates";
import { zonedOccurrenceStart } from "@/lib/time-of-day";

// The override query is mocked with each test's rows, so these tests cover the
// date rules, not the query.
const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { availabilityOverride: { findMany } } }));

const { getBookableDates, isRequestedSlotValid, MAX_OPEN_EXTENSION_DAYS } = await import("@/lib/availability");

type TestListing = Parameters<typeof getBookableDates>[0];

const SYDNEY = "Australia/Sydney";
// Monday 2 November 2026, midday in Sydney (01:00 UTC).
const NOW = new Date("2026-11-02T01:00:00Z");
const TODAY = new Date("2026-11-02T00:00:00Z");
const day = (offset: number) => addDays(TODAY, offset);

function listing(overrides: Partial<TestListing> & { mechanic?: TestListing["activity"]["bookingMechanic"]; timeZone?: string } = {}): TestListing {
  const { mechanic = "time_range", timeZone = SYDNEY, ...rest } = overrides;
  return {
    id: "listing-1",
    venueId: "venue-1",
    activity: { bookingMechanic: mechanic },
    venue: { bookingWindowDays: 30, city: { timezone: timeZone } },
    capacity: 1,
    operatingHoursStart: "08:00",
    operatingHoursEnd: "20:00",
    incrementMinutes: 30,
    minDurationMinutes: 60,
    maxDurationMinutes: 120,
    minDurationDays: null,
    maxDurationDays: null,
    recurrenceDayOfWeek: null,
    recurrenceStartTime: null,
    sessionDurationMinutes: null,
    ...rest,
  } as TestListing;
}

function override(fields: Partial<AvailabilityOverride> & Pick<AvailabilityOverride, "kind" | "startDate">): AvailabilityOverride {
  return {
    id: crypto.randomUUID(),
    venueId: "venue-1",
    listingId: null,
    daysOfWeek: [],
    endDate: null,
    startTime: null,
    endTime: null,
    reason: null,
    createdAt: NOW,
    ...fields,
  };
}

const times = (dates: Date[]) => dates.map((d) => d.getTime());

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getBookableDates", () => {
  it("is every day from the venue's today through the booking window", async () => {
    const dates = await getBookableDates(listing());
    expect(dates).toHaveLength(31);
    expect(dates[0]).toEqual(TODAY);
    expect(dates.at(-1)).toEqual(day(30));
  });

  it("starts from the venue's own today, not the server's", async () => {
    // 01:00 UTC on 2 November is still 1 November in Los Angeles.
    const dates = await getBookableDates(listing({ timeZone: "America/Los_Angeles" }));
    expect(dates[0]).toEqual(day(-1));
  });

  it("drops a day a venue-wide block covers", async () => {
    findMany.mockResolvedValue([override({ kind: "block", startDate: day(3) })]);
    const dates = times(await getBookableDates(listing()));
    expect(dates).not.toContain(day(3).getTime());
    expect(dates).toContain(day(2).getTime());
    expect(dates).toContain(day(4).getTime());
  });

  it("applies a recurring block only on its weekdays, between its dates", async () => {
    // Every Saturday (6) in the next two weeks.
    findMany.mockResolvedValue([override({ kind: "block", startDate: TODAY, endDate: day(13), daysOfWeek: [6] })]);
    const dates = times(await getBookableDates(listing()));
    expect(dates).not.toContain(day(5).getTime()); // Sat 7 Nov
    expect(dates).not.toContain(day(12).getTime()); // Sat 14 Nov
    expect(dates).toContain(day(19).getTime()); // Sat 21 Nov, after the block ends
    expect(dates).toContain(day(6).getTime()); // a Sunday
  });

  it("lets a listing's own open override beat a venue-wide block on the same day", async () => {
    findMany.mockResolvedValue([
      override({ kind: "block", startDate: day(3) }),
      override({ kind: "open", startDate: day(3), listingId: "listing-1", venueId: null }),
    ]);
    expect(times(await getBookableDates(listing()))).toContain(day(3).getTime());
  });

  it("ignores another listing's override", async () => {
    findMany.mockResolvedValue([override({ kind: "block", startDate: day(3), listingId: "listing-2", venueId: null })]);
    expect(times(await getBookableDates(listing()))).toContain(day(3).getTime());
  });

  it("adds a day past the window only when an open override covers it", async () => {
    findMany.mockResolvedValue([override({ kind: "open", startDate: day(40) })]);
    const dates = times(await getBookableDates(listing()));
    expect(dates).toContain(day(40).getTime());
    expect(dates).not.toContain(day(39).getTime());
    expect(dates).not.toContain(day(41).getTime());
  });

  it("never opens anything past the 90-day ceiling", async () => {
    findMany.mockResolvedValue([override({ kind: "open", startDate: day(31), endDate: day(400) })]);
    const dates = await getBookableDates(listing());
    expect(dates.at(-1)).toEqual(day(MAX_OPEN_EXTENSION_DAYS));
  });

  it("offers a class only on its own weekday, even when an override opens another day", async () => {
    findMany.mockResolvedValue([override({ kind: "open", startDate: day(1) })]); // a Tuesday
    const dates = await getBookableDates(
      listing({ mechanic: "fixed_session", recurrenceDayOfWeek: 1, recurrenceStartTime: "18:00", sessionDurationMinutes: 60 })
    );
    expect(dates.every((d) => d.getUTCDay() === 1)).toBe(true);
    expect(dates[0]).toEqual(TODAY);
    expect(times(dates)).not.toContain(day(1).getTime());
  });

  describe("same-day cut-off for passes and stays", () => {
    const pass = (operatingHoursEnd: string | null) =>
      listing({ mechanic: "date_range", operatingHoursStart: "06:00", operatingHoursEnd, minDurationDays: 1, maxDurationDays: 5 });

    it("keeps today while there's more than an hour until closing", async () => {
      expect((await getBookableDates(pass("22:00")))[0]).toEqual(TODAY);
    });

    it("drops today from an hour before closing", async () => {
      // Midday in Sydney, closing at 13:00: the cut-off was 12:00.
      expect((await getBookableDates(pass("13:00")))[0]).toEqual(day(1));
    });

    it("drops today when no closing time is set", async () => {
      expect((await getBookableDates(pass(null)))[0]).toEqual(day(1));
    });
  });
});

describe("isRequestedSlotValid", () => {
  describe("courts (time_range)", () => {
    const court = listing();
    const bookable = [TODAY, day(1), day(2)];
    const at = (offset: number, time: string) => zonedOccurrenceStart(day(offset), time, SYDNEY);
    const hours = (start: Date, h: number) => new Date(start.getTime() + h * 3600_000);

    it("accepts a slot inside opening hours, on the step, within the allowed lengths", () => {
      const start = at(1, "10:00");
      expect(isRequestedSlotValid(court, start, hours(start, 1), bookable)).toBe(true);
      expect(isRequestedSlotValid(court, start, hours(start, 2), bookable)).toBe(true);
    });

    it("rejects a start time that has already passed today", () => {
      const start = at(0, "10:00"); // two hours ago
      expect(isRequestedSlotValid(court, start, hours(start, 1), bookable)).toBe(false);
    });

    it("rejects a day that isn't bookable", () => {
      const start = at(5, "10:00");
      expect(isRequestedSlotValid(court, start, hours(start, 1), bookable)).toBe(false);
    });

    it("rejects starting before opening or ending after closing", () => {
      const early = at(1, "07:30");
      expect(isRequestedSlotValid(court, early, hours(early, 1), bookable)).toBe(false);
      const late = at(1, "19:30");
      expect(isRequestedSlotValid(court, late, hours(late, 1), bookable)).toBe(false);
    });

    it("rejects a start off the 30-minute step", () => {
      const start = at(1, "10:15");
      expect(isRequestedSlotValid(court, start, hours(start, 1), bookable)).toBe(false);
    });

    it("rejects lengths outside 60-120 minutes", () => {
      const start = at(1, "10:00");
      expect(isRequestedSlotValid(court, start, hours(start, 0.5), bookable)).toBe(false);
      expect(isRequestedSlotValid(court, start, hours(start, 3), bookable)).toBe(false);
    });

    it("rejects an end at or before the start", () => {
      const start = at(1, "10:00");
      expect(isRequestedSlotValid(court, start, start, bookable)).toBe(false);
      expect(isRequestedSlotValid(court, start, hours(start, -1), bookable)).toBe(false);
    });

    it("rejects an overnight booking", () => {
      const allDay = listing({ operatingHoursStart: "00:00", operatingHoursEnd: "23:59", maxDurationMinutes: 240 });
      const start = at(1, "22:00");
      expect(isRequestedSlotValid(allDay, start, hours(start, 3), bookable)).toBe(false);
    });
  });

  describe("passes and stays (date_range)", () => {
    const pass = listing({ mechanic: "date_range", minDurationDays: 1, maxDurationDays: 3 });

    it("accepts a whole number of days within the bounds", () => {
      expect(isRequestedSlotValid(pass, day(1), day(2), [day(1)])).toBe(true);
      expect(isRequestedSlotValid(pass, day(1), day(4), [day(1)])).toBe(true);
    });

    it("rejects more days than the maximum", () => {
      expect(isRequestedSlotValid(pass, day(1), day(5), [day(1)])).toBe(false);
    });

    it("accepts today at a venue behind UTC (days are calendar days, not instants)", () => {
      // 01:00 UTC is the previous evening in New York; a UTC-midnight day must
      // not be read on New York's clock.
      const ny = listing({ mechanic: "date_range", timeZone: "America/New_York", minDurationDays: 1, maxDurationDays: 3 });
      expect(isRequestedSlotValid(ny, day(-1), TODAY, [day(-1)])).toBe(true);
    });
  });

  describe("classes (fixed_session)", () => {
    const yoga = listing({ mechanic: "fixed_session", recurrenceDayOfWeek: 1, recurrenceStartTime: "18:00", sessionDurationMinutes: 60 });
    const start = zonedOccurrenceStart(day(7), "18:00", SYDNEY);

    it("accepts the exact session", () => {
      expect(isRequestedSlotValid(yoga, start, new Date(start.getTime() + 3600_000), [day(7)])).toBe(true);
    });

    it("rejects a different start time or length", () => {
      const late = zonedOccurrenceStart(day(7), "18:30", SYDNEY);
      expect(isRequestedSlotValid(yoga, late, new Date(late.getTime() + 3600_000), [day(7)])).toBe(false);
      expect(isRequestedSlotValid(yoga, start, new Date(start.getTime() + 2 * 3600_000), [day(7)])).toBe(false);
    });
  });
});
