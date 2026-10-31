// Shared with the skeletons so their bones match. Not in a "use client" module:
// values exported from one read as undefined in server code.
export const CATEGORY_LABEL_TEXT_CLASS = "text-sm font-medium";
export const TAG_LABEL_TEXT_CLASS = "text-sm font-medium";

// A tag colour darkened for use as text. Tag colours are chosen as accents and
// can fall below 2:1 as text on white; mixing in 40% black keeps the hue and
// brings every seeded colour to at least ~4.9:1 on white, the page background
// and the tinted pill.
export function tagTextColor(color: string): string {
  return `color-mix(in srgb, ${color} 60%, black)`;
}
