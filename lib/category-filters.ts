// Sidebar categories map directly onto Activity.bookingMechanic (see
// schema.prisma), not a hand-picked tag grouping. Each id is the literal
// BookingMechanic value, so no lookup table is needed to turn a selection
// into a Prisma query condition (see ListingSection). Tags stay a fully
// separate, freely combinable filter (for example "Classes" plus "Tennis"
// together narrows to Tennis classes specifically), even though "Classes"
// also exists as a tag.
//
// description is the plain-language blurb shown in the info popover next
// to each mechanic's section heading on the browse page (see
// listing-section.tsx). It lives here, next to each category's id and
// label, so there is one place that defines what a mechanic means.
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

// The three real mechanics, in display order, with no "all" entry. Used
// wherever a mechanic-specific list is needed (ListingSection's grouping
// headers) rather than the full sidebar list. This file never imports the
// Prisma client, since BrowseSidebarPanel (a Client Component) imports
// from it, and the Prisma client pulls in Node-only code Turbopack cannot
// bundle for the browser. That is why ids are plain string literals
// instead of the generated BookingMechanic enum.
export const MECHANIC_CATEGORIES = CATEGORIES.filter((category) => category.id !== "all");
