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

export function t(key: MessageKey, locale: Locale = defaultLocale): string {
  const value = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], dictionaries[locale]);
  return typeof value === "string" ? value : key;
}

/** Formats an AZN amount, e.g. 350 → "350 ₼". */
export function formatAzn(amount: number): string {
  return `${new Intl.NumberFormat("az-Latn-AZ", { maximumFractionDigits: 2 }).format(amount)} ${t("currency.symbol")}`;
}
