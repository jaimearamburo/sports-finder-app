import { describe, expect, it } from "vitest";
import { bookingFiltersQuery, parseBookingFilters } from "@/lib/validation/manager-bookings";

describe("parseBookingFilters", () => {
  it("defaults to upcoming, page 1, no filters", () => {
    expect(parseBookingFilters({})).toEqual({ when: "upcoming", page: 1 });
  });

  it("reads valid values", () => {
    expect(parseBookingFilters({ when: "past", venue: "v1", listing: "l1", from: "2026-11-01", to: "2026-11-30", q: " Alex ", page: "3" })).toEqual({
      when: "past",
      venue: "v1",
      listing: "l1",
      from: "2026-11-01",
      to: "2026-11-30",
      q: "Alex",
      page: 3,
    });
  });

  it("falls back on junk instead of failing", () => {
    expect(parseBookingFilters({ when: "tomorrow", page: "abc", from: "2026-13-45", to: "soon", q: "x".repeat(101) })).toEqual({
      when: "upcoming",
      page: 1,
    });
    expect(parseBookingFilters({ page: "-2" }).page).toBe(1);
  });

  it("takes the first value when a param is repeated", () => {
    expect(parseBookingFilters({ when: ["past", "all"] }).when).toBe("past");
  });

  it("swaps a reversed date range", () => {
    expect(parseBookingFilters({ from: "2026-12-01", to: "2026-11-01" })).toMatchObject({ from: "2026-11-01", to: "2026-12-01" });
  });

  it("cuts an over-long range to a year", () => {
    expect(parseBookingFilters({ from: "2026-01-01", to: "2030-01-01" })).toMatchObject({ from: "2026-01-01", to: "2027-01-01" });
  });
});

describe("bookingFiltersQuery", () => {
  it("leaves defaults out of the URL", () => {
    expect(bookingFiltersQuery({ when: "upcoming", page: 1 })).toBe("");
  });

  it("applies changes on top of the current filters", () => {
    const filters = parseBookingFilters({ when: "past", q: "Alex", page: "4" });
    expect(bookingFiltersQuery(filters, { page: 1 })).toBe("when=past&q=Alex");
    expect(bookingFiltersQuery(filters, { page: 5 })).toBe("when=past&q=Alex&page=5");
  });
});
