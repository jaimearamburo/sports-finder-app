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
// description is the friendly, plain-language blurb shown in the info
// popover next to each mechanic section heading on the browse page (see
// listing-section.tsx) - kept alongside each category's own id/label so
// there's one place that knows what a mechanic actually means, rather
// than a second lookup table that could drift out of sync with this one.
export const CATEGORIES = [
  {
    id: "all",
    label: "All",
    description: "Every sport and activity in one place, from courts and classes to multi-day passes.",
  },
  {
    id: "time_range",
    label: "Book a time",
    description:
      "Hire a court or space for a set block of time. Pick a date, choose your start time, and how long you need it for.",
  },
  {
    id: "fixed_session",
    label: "Classes",
    description: "Scheduled sessions that run on a fixed day and time each week. Just grab a spot before it fills up.",
  },
  {
    id: "date_range",
    label: "Multi-day",
    // Not just stays - date_range covers any activity booked across a
    // span of days, a campsite reservation and a multi-day gym pass
    // alike, so the description can't be campsite-specific wording.
    description:
      "Booked by the day for however long you need it, like a campsite stay or a multi-day gym pass. Pick your desired dates.",
  },
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
