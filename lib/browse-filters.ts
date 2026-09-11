// APP ACTIVITIES BROWSING HELPER FUNCTION

// This file is imported by both server code (app/page.tsx) and Client
// Components (CategoryNav, TagChipRow) — it must never import the full
// Prisma client (../generated/prisma/client), which pulls in Node-only
// runtime code that Turbopack can't bundle for the browser. That's why
// "time_range" below is a plain string literal instead of the generated
// BookingMechanic enum: same runtime value, no heavy import.

// Sidebar categories are a small, fixed, hand-picked grouping — not a
// database table. Tags are deliberately cross-cutting (an Activity can
// carry several, e.g. "Tennis Class" is tagged both "Tennis" and
// "Classes" — see schema.prisma), so a rigid Category-owns-Tags hierarchy
// would fight that design. Each category below is just a shortcut for one
// Activity-level condition, ANDed with whatever tags are separately
// selected — see app/page.tsx.
export const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "courts", label: "Courts for hire" },
  { id: "classes", label: "Classes" },
  { id: "gym", label: "Gym" },
  { id: "camping", label: "Camping" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

// 
export function isCategoryId(value: string): value is CategoryId {
  return CATEGORIES.some((category) => category.id === value);
}

// "all" category has no entry here — spreading `undefined` into an
// object literal (`{ ...undefined }`) is a no-op, so no special case is
// needed in app/page.tsx's query.
export const CATEGORY_FILTERS = {
  courts: { bookingMechanic: "time_range" as const },
  classes: { tags: { some: { tag: { name: "Classes" } } } },
  gym: { tags: { some: { tag: { name: "Fitness" } } } },
  camping: { tags: { some: { tag: { name: "Camping" } } } },
};

// Per-tag glyph + slug, keyed by the real Tag.name from the database. Tag
// has no icon/color/order column of its own (see schema.prisma), so this
// is the one place that needs updating if a new tag is seeded.
// TODO: Make glyph selection database driven.
//
// `slug` feeds the `border-tag-*`/`bg-tag-*`/`text-tag-*` classes defined
// in globals.css (each tag's actual color lives there, not here — this
// object only says which color a tag maps to).
//
// Key order here IS the display order of the chip row.
// TODO: Make tag chips order also databse driven.
export const TAG_STYLES: Record<string, { emoji: string; slug: string }> = {
  Tennis: { emoji: "🎾", slug: "tennis" },
  Classes: { emoji: "👥", slug: "classes" },
  Fitness: { emoji: "💪", slug: "fitness" },
  Football: { emoji: "⚽", slug: "football" },
  Padel: { emoji: "🏓", slug: "padel" },
  Camping: { emoji: "⛺", slug: "camping" },
};

// Derived from TAG_STYLES's own key order — a single place to change the
// chip row's order rather than two lists that could drift out of sync.
export const TAG_ORDER = Object.keys(TAG_STYLES);
