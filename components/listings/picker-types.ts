// A client-safe subset of Listing. pricePerUnit is a plain number because
// Prisma's Decimal can't be passed to a Client Component.
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
  // date_range only: decides the calendar mode and day/night wording.
  isAccommodation: boolean;
  // null = unlimited. Decides whether SlotPicker shows a quantity stepper and
  // caps it.
  capacity: number | null;
  // Per-booking cap on quantity; null means no cap beyond capacity.
  maxBookingsPerTransaction: number | null;
  // The venue's IANA timezone; opening hours, recurrence times and "today" are
  // all venue wall-clock values.
  venueTimezone: string;
};

// One bookable span. A pass produces one per picked day; every other mechanic
// produces one per selection. Always an array, so pricing logic is the same for
// all.
export type SelectedSlot = { startsAt: Date; endsAt: Date };
export type SelectedSlots = SelectedSlot[];
