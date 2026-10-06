// A plain, client-safe subset of Listing's fields - never the raw Prisma
// row. pricePerUnit in particular has to be a plain number here: Prisma's
// Decimal is a class instance, and React Server Components can only pass
// plain serializable data (objects, arrays, primitives, Date) as props
// into a Client Component.
export type PickerListing = {
  bookingMechanic: "time_range" | "date_range" | "fixed_session";
  pricePerUnit: number;
  operatingHoursStart: string | null;
  operatingHoursEnd: string | null;
  minDurationMinutes: number | null;
  maxDurationMinutes: number | null;
  incrementMinutes: number | null;
  minDurationDays: number | null;
  maxDurationDays: number | null;
  recurrenceStartTime: string | null;
  sessionDurationMinutes: number | null;
  // Only meaningful for date_range (see the field's own comment in
  // schema.prisma) - decides both the calendar's interaction mode and the
  // day/night wording in DateRangePicker.
  isAccommodation: boolean;
};

// One atomic bookable span. Every mechanic produces one of these per
// selection, except a non-accommodation date_range listing (a pass),
// which produces one per individually-picked day - a "3-day pass"
// selecting the 19th/23rd/30th is three separate one-day spans, not one
// span covering the whole range (that would wrongly claim the gap days
// too). SelectedSlots is always the array, even when every other mechanic
// only ever puts one entry in it - that keeps SlotPicker's price/total
// logic the same regardless of how many spans a given mechanic produces.
export type SelectedSlot = { startsAt: Date; endsAt: Date };
export type SelectedSlots = SelectedSlot[];
