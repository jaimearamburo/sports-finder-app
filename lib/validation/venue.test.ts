import { describe, expect, it } from "vitest";
import { venueSchema, type VenueInput } from "@/lib/validation/venue";
import { getFieldErrors } from "@/lib/validation/field-errors";

const valid: VenueInput = {
  name: "Riverside Sports Club",
  description: "",
  address: "12 River Rd",
  cityId: "city-1",
  bookingWindowDays: 30,
  holdDurationMinutes: 5,
};

function errorsFor(input: Partial<VenueInput>) {
  const result = venueSchema.safeParse({ ...valid, ...input });
  return result.success ? {} : getFieldErrors(result.error);
}

describe("venueSchema", () => {
  it("accepts a complete venue and trims text", () => {
    const result = venueSchema.parse({ ...valid, name: "  Riverside  ", address: " 12 River Rd " });
    expect(result.name).toBe("Riverside");
    expect(result.address).toBe("12 River Rd");
  });

  it("stores an empty description as null", () => {
    expect(venueSchema.parse(valid).description).toBeNull();
    expect(venueSchema.parse({ ...valid, description: "   " }).description).toBeNull();
  });

  it("requires a name, an address and a city", () => {
    expect(errorsFor({ name: "  " }).name).toBe("Enter the venue's name.");
    expect(errorsFor({ address: "" }).address).toBe("Enter the venue's street address.");
    expect(errorsFor({ cityId: "" }).cityId).toBe("Choose a city.");
  });

  it("caps text lengths", () => {
    expect(errorsFor({ name: "x".repeat(101) }).name).toMatch(/100 characters/);
    expect(errorsFor({ description: "x".repeat(1001) }).description).toMatch(/1000 characters/);
  });

  it("keeps the booking window and hold time within range", () => {
    expect(errorsFor({ bookingWindowDays: 0 }).bookingWindowDays).toBe("The booking window must be between 1 and 180.");
    expect(errorsFor({ bookingWindowDays: 181 }).bookingWindowDays).toBeDefined();
    expect(errorsFor({ holdDurationMinutes: 1 }).holdDurationMinutes).toBe("The hold time must be between 2 and 30.");
    expect(errorsFor({ holdDurationMinutes: 31 }).holdDurationMinutes).toBeDefined();
  });

  it("rejects numbers that aren't whole, or aren't numbers at all", () => {
    expect(errorsFor({ bookingWindowDays: 7.5 }).bookingWindowDays).toBe("Enter the booking window as a whole number.");
    expect(errorsFor({ holdDurationMinutes: Number.NaN }).holdDurationMinutes).toBe("Enter the hold time as a whole number.");
  });
});
