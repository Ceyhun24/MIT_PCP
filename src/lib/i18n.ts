// All UI text lives in src/locales/<lang>.json. To add a language, add a new
// JSON file with the same keys and register it in `dictionaries`.
import az from "@/locales/az.json";

export const dictionaries = { az } as const;
export type Locale = keyof typeof dictionaries;
export const defaultLocale: Locale = "az";

type Dict = typeof az;
// "a.b.c" style keys, derived from the Azerbaijani file.
type Paths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];
export type MessageKey = Paths<Dict>;

/** Looks up a message; "{name}" placeholders are replaced from `vars`. */
export function t(key: MessageKey, vars?: Record<string, string | number>, locale: Locale = defaultLocale): string {
  const value = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], dictionaries[locale]);
  if (typeof value !== "string") return key;
  return vars ? value.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m)) : value;
}

/** Looks up a message whose last key segment is dynamic (e.g. an amenity slug). */
export function tDynamic(prefix: "amenities" | "languages" | "pricePeriod" | "sections" | "type" | "verification", key: string): string {
  const group = dictionaries[defaultLocale][prefix] as Record<string, string>;
  return group[key] ?? key;
}
