import { t } from "@/lib/i18n";

// Azerbaijani number style ("1 250,5"). Hand-written instead of Intl so the
// server and every browser produce exactly the same text.
function formatNumber(value: number, maxDecimals: number): string {
  const fixed = value.toFixed(maxDecimals).replace(/\.?0+$/, "");
  const [int, frac] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  return frac ? `${grouped},${frac}` : grouped;
}
const numberFormat = { format: (v: number) => formatNumber(v, 2) };
const oneDecimal = { format: (v: number) => formatNumber(v, 1) };

export const num = (v: number | string | null | undefined): number | null =>
  v === null || v === undefined || v === "" ? null : Number(v);

/** 350 → "350 ₼" */
export function formatAzn(amount: number): string {
  return `${numberFormat.format(amount)} ${t("currency.symbol")}`;
}

/** Price range → "350–500 ₼", "350 ₼" or null when unknown. */
export function formatPriceRange(min: number | string | null, max: number | string | null): string | null {
  const a = num(min), b = num(max);
  if (a === null && b === null) return null;
  if (a !== null && b !== null && a !== b) return `${numberFormat.format(a)}–${formatAzn(b)}`;
  return formatAzn((a ?? b)!);
}

export function formatAgeRange(min: number | string | null, max: number | string | null): string | null {
  const a = num(min), b = num(max);
  if (a === null && b === null) return null;
  if (a !== null && b !== null) return a === b ? t("units.years", { value: oneDecimal.format(a) }) : t("units.yearsRange", { min: oneDecimal.format(a), max: oneDecimal.format(b) });
  if (a !== null) return t("units.yearsFrom", { min: oneDecimal.format(a) });
  return t("units.yearsTo", { max: oneDecimal.format(b!) });
}

export function formatDistance(meters: number | null): string | null {
  if (meters === null || meters === undefined) return null;
  if (meters < 1000) return t("units.m", { value: Math.round(meters / 10) * 10 });
  return t("units.km", { value: oneDecimal.format(meters / 1000) });
}

const months = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"];
/** "25 sentyabr 2026" — independent of the server's ICU data. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatRating(avg: number | string | null): string {
  return oneDecimal.format(Number(avg ?? 0));
}
