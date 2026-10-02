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
};

export type SelectedSlot = { startsAt: Date; endsAt: Date };
