// The browse `city` param can hold several comma-separated city names
// (e.g. "Brisbane,Perth" from a search like "somewhere warm"), but the city
// dropdowns pick one at a time. While several are active, the dropdowns
// show this placeholder value instead: a disabled "Multiple cities" entry,
// so the current state is visible, and picking any city replaces the set.
// City names never contain commas (only their display labels do - see
// lib/browse-cities.ts), so the comma is a safe separator.
export const MULTIPLE_CITIES_VALUE = "__multiple__";
export const MULTIPLE_CITIES_LABEL = "Multiple cities";

export function citySelectValue(city: string): string {
  if (city === "") return "all";
  return city.includes(",") ? MULTIPLE_CITIES_VALUE : city;
}
