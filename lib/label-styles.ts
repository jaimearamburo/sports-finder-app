// Shared with each skeleton so its label bone tracks whatever text size
// the real label uses. Kept in a plain module with no "use client"
// directive: a value exported from a Client Component resolves to
// undefined when read from server-rendered code, so these can't live in
// the client components that also use them.
export const CATEGORY_LABEL_TEXT_CLASS = "text-sm font-medium";
export const TAG_LABEL_TEXT_CLASS = "text-sm font-medium";
