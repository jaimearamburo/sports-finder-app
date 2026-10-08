// Sidebar categories are the booking-mechanic axis (see Activity.bookingMechanic
// in schema.prisma), not a hand-picked tag grouping. An earlier version of
// this file mapped some categories to tags (Classes, Gym, Camping) and only
// one to a mechanic (Courts for hire) — that mix made this filter fully
// redundant with the sidebar's separate "Booking type" checklist, since both
// ultimately narrowed by mechanic. Folding them into one mechanic-only
// control removes that duplication; id and BookingMechanic value are now the
// same string, so no lookup table is needed to turn a selection into a
// Prisma condition (see ListingSection). Tags stay entirely separate and
// freely combinable with this filter (e.g. "Classes" + "Tennis" together
// still narrows to Tennis classes specifically) — deliberately not merged
// in here even though "Classes" exists as both a category and a tag.
export const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "time_range", label: "Book a time" },
  { id: "fixed_session", label: "Classes" },
  { id: "date_range", label: "Multi-day" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

// A real runtime check, not just a type assertion. The category query
// param comes straight from the URL, which anyone can hand-edit to any
// string.
export function isCategoryId(value: string): value is CategoryId {
  return CATEGORIES.some((category) => category.id === value);
}

// The three real mechanics, in display order, with no "all" entry — used
// wherever a mechanic-specific list is needed (ListingSection's grouping
// headers) rather than the full sidebar list. This file never imports the
// full Prisma client, since that pulls in Node-only runtime code Turbopack
// cannot bundle for the browser, and BrowseSidebarPanel, a Client Component,
// imports from this file. That is why the ids below are plain string
// literals instead of the generated BookingMechanic enum.
export const MECHANIC_CATEGORIES = CATEGORIES.filter((category) => category.id !== "all");
