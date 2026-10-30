import { describe, expect, it } from "vitest";
import { formatMinutes, listingKindFor, parseListing, type ListingFormInput } from "@/lib/validation/listing";

const base: ListingFormInput = {
  activityId: "activity-1",
  name: "Court 1",
  description: "",
  price: 20,
  capacity: 1,
  maxPerBooking: 1,
  openingTime: "08:00",
  closingTime: "22:00",
  startStepMinutes: 30,
  minDurationMinutes: 60,
  maxDurationMinutes: 120,
  minDays: 1,
  maxDays: 5,
  weekday: 1,
  startTime: "18:00",
  sessionMinutes: 45,
};

function errors(kind: Parameters<typeof parseListing>[0], change: Partial<ListingFormInput>) {
  const result = parseListing(kind, { ...base, ...change });
  return result.ok ? {} : result.fieldErrors;
}

describe("listingKindFor", () => {
  it("picks the form from the activity", () => {
    expect(listingKindFor({ bookingMechanic: "time_range", isAccommodation: false })).toBe("court");
    expect(listingKindFor({ bookingMechanic: "date_range", isAccommodation: false })).toBe("pass");
    expect(listingKindFor({ bookingMechanic: "date_range", isAccommodation: true })).toBe("stay");
    expect(listingKindFor({ bookingMechanic: "fixed_session", isAccommodation: false })).toBe("class");
  });
});

describe("parseListing: shared fields", () => {
  it("accepts a valid court and trims text", () => {
    const result = parseListing("court", { ...base, name: "  Court 1  ", description: "  " });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe("Court 1");
      expect(result.data.description).toBeNull();
    }
  });

  it("requires an activity and a name", () => {
    expect(errors("court", { activityId: "" }).activityId).toBe("Choose an activity.");
    expect(errors("court", { name: " " }).name).toBe("Enter the listing's name.");
  });

  it("checks the price", () => {
    expect(errors("court", { price: -1 }).price).toBe("The price can't be negative.");
    expect(errors("court", { price: 10.005 }).price).toBe("Use at most two decimal places.");
    expect(errors("court", { price: 19.99 }).price).toBeUndefined();
    expect(errors("court", { price: 0 }).price).toBeUndefined();
  });

  it("keeps the per-booking limit within capacity", () => {
    expect(errors("pass", { capacity: 4, maxPerBooking: 5 }).maxPerBooking).toBe("Can't be more than the capacity.");
    expect(errors("pass", { capacity: null, maxPerBooking: 5 }).maxPerBooking).toBeUndefined();
  });
});

describe("parseListing: courts", () => {
  it("needs a capacity (no unlimited courts)", () => {
    expect(errors("court", { capacity: null }).capacity).toBeDefined();
  });

  it("keeps times on the start-time step", () => {
    expect(errors("court", { openingTime: "08:15" }).openingTime).toBe("Must be on a 30-minute mark, like 08:00.");
    expect(errors("court", { openingTime: "08:15", startStepMinutes: 15 }).openingTime).toBeUndefined();
    expect(errors("court", { minDurationMinutes: 45 }).minDurationMinutes).toBe("Must be a multiple of 30 minutes.");
  });

  it("checks the hours and booking lengths make sense", () => {
    expect(errors("court", { closingTime: "08:00" }).closingTime).toBe("Must be after the opening time.");
    expect(errors("court", { maxDurationMinutes: 30 }).maxDurationMinutes).toBe("Can't be shorter than the shortest booking.");
    expect(errors("court", { openingTime: "08:00", closingTime: "09:00" }).maxDurationMinutes).toBe("Longer than the opening hours.");
  });

  it("only allows the offered start steps", () => {
    expect(errors("court", { startStepMinutes: 20 }).startStepMinutes).toBeDefined();
  });
});

describe("parseListing: passes and stays", () => {
  it("needs opening hours for a pass, in order", () => {
    expect(errors("pass", { closingTime: "05:00" }).closingTime).toBe("Must be after the opening time.");
  });

  it("only needs a check-in deadline for a stay", () => {
    expect(parseListing("stay", { ...base, openingTime: "nonsense" }).ok).toBe(true);
    expect(errors("stay", { closingTime: "8pm" }).closingTime).toBe("Enter a check-in deadline as a time, like 09:00.");
  });

  it("keeps the day range in order", () => {
    expect(errors("pass", { minDays: 3, maxDays: 2 }).maxDays).toBe("Can't be fewer than the minimum.");
    expect(errors("stay", { maxDays: 31 }).maxDays).toBe("The maximum must be between 1 and 30.");
  });
});

describe("parseListing: classes", () => {
  it("allows unlimited capacity", () => {
    expect(parseListing("class", { ...base, capacity: null }).ok).toBe(true);
  });

  it("needs the session to finish by midnight", () => {
    expect(errors("class", { startTime: "23:30", sessionMinutes: 45 }).sessionMinutes).toBe("The session must finish by midnight.");
  });

  it("checks the weekday", () => {
    expect(errors("class", { weekday: 7 }).weekday).toBeDefined();
  });
});

describe("formatMinutes", () => {
  it("reads naturally", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(60)).toBe("1 hr");
    expect(formatMinutes(90)).toBe("1 hr 30 min");
  });
});
