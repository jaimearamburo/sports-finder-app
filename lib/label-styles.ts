// Shared with each skeleton so its label bone tracks whatever text size
// the real label uses. Kept in a plain module with no "use client"
// directive: a value exported from a Client Component resolves to
// undefined when read from server-rendered code, so these can't live in
// the client components that also use them.
export const CATEGORY_LABEL_TEXT_CLASS = "text-sm font-medium";
export const TAG_LABEL_TEXT_CLASS = "text-sm font-medium";

// A tag's colour (Tag.color, editable data) darkened for use as TEXT. Raw
// tag colours are picked to read well as accents (borders, chip fills),
// not as small text: as text on white they measured as low as 1.9:1
// (the yellow), far under WCAG AA's 4.5:1. Mixing in 40% black keeps each
// tag's hue recognisable while bringing every seeded colour to at least
// ~4.9:1, on white, on the page background, and on the tag's own tinted
// pill. Done in CSS rather than by changing the stored colours, so the
// accent uses stay bright.
export function tagTextColor(color: string): string {
  return `color-mix(in srgb, ${color} 60%, black)`;
}
