// Sidebar categories map directly onto Activity.bookingMechanic: each id is the
// BookingMechanic value, so it filters with no lookup. Tags remain a separate,
// combinable filter ("Classes" + "Tennis" narrows to tennis classes).
//
// `description` is the blurb in the info popover beside each section heading,
// defined here with the id and label.
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
    // date_range covers campsites and multi-day passes alike.
    description:
      "Booked by the day for however long you need it, like a campsite stay or a multi-day gym pass. Pick your desired dates.",
  },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

// A runtime check: the category param comes from the URL.
export function isCategoryId(value: string): value is CategoryId {
  return CATEGORIES.some((category) => category.id === value);
}

// The three mechanics in display order, without "all". Ids are plain strings
// rather than the generated enum because a Client Component imports this file,
// and the Prisma client can't be bundled for the browser.
export const MECHANIC_CATEGORIES = CATEGORIES.filter((category) => category.id !== "all");
