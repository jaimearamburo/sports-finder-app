// The browse `city` param can hold several comma-separated names (e.g. from
// "somewhere warm"), but the city dropdowns pick one. While several are active
// they show a disabled "Multiple cities" entry; picking a city replaces the
// set. City names never contain commas.
export const MULTIPLE_CITIES_VALUE = "__multiple__";
export const MULTIPLE_CITIES_LABEL = "Multiple cities";

export function citySelectValue(city: string): string {
  if (city === "") return "all";
  return city.includes(",") ? MULTIPLE_CITIES_VALUE : city;
}
