// Fixed slider bounds for the sidebar's price filter rather than a
// database-derived min/max, matching the seeded listing prices ($12-$60).
// PRICE_MAX doubles as an open-ended upper bound: a value at or above it
// is displayed as "$100+" and applies no upper limit to the query.
export const PRICE_MIN = 0;
export const PRICE_MAX = 100;
export const PRICE_STEP = 5;
