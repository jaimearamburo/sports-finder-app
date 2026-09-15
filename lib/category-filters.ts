// Sidebar categories are a small, fixed, hand-picked grouping, not a
// database table. Tags are deliberately cross-cutting: an Activity can
// carry several, for example "Tennis Class" is tagged both "Tennis" and
// "Classes" (see schema.prisma), so a rigid category-owns-tags hierarchy
// would fight that design. Each category below is just a shortcut for one
// Activity-level condition, ANDed with whatever tags are separately
// selected in app/page.tsx.
//
// Tag display data (emoji, color, order) lives on the Tag model itself
// (see schema.prisma and lib/browse-tags.ts) so the admin UI can edit it
// without a code deploy. Categories stay hardcoded here on purpose: they
// are a small curated product decision that rarely changes, not editable
// data.
export const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "courts", label: "Courts for hire" },
  { id: "classes", label: "Classes" },
  { id: "gym", label: "Gym" },
  { id: "camping", label: "Camping" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

// A real runtime check, not just a type assertion. The category query
// param comes straight from the URL, which anyone can hand-edit to any
// string.
export function isCategoryId(value: string): value is CategoryId {
  return CATEGORIES.some((category) => category.id === value);
}

// "all" has no entry here since spreading undefined into an object
// literal is a no-op, so no special case is needed in app/page.tsx's
// query. This file never imports the full Prisma client, since that
// pulls in Node-only runtime code Turbopack cannot bundle for the
// browser, and CategoryFilters, a Client Component, imports from this
// file. That is why "time_range" below is a plain string literal instead
// of the generated BookingMechanic enum.
export const CATEGORY_FILTERS = {
  courts: { bookingMechanic: "time_range" as const },
  classes: { tags: { some: { tag: { name: "Classes" } } } },
  gym: { tags: { some: { tag: { name: "Fitness" } } } },
  camping: { tags: { some: { tag: { name: "Camping" } } } },
};
