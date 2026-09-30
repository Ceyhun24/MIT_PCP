// Baku districts (must match the "districts" table) and a matcher that maps
// names found in sources (Azerbaijani or English spelling) to a district slug.

export const DISTRICTS: { slug: string; name: string; keys: string[] }[] = [
  { slug: "binaqadi", name: "Binəqədi", keys: ["binegedi", "binagadi"] },
  { slug: "qaradag", name: "Qaradağ", keys: ["qaradag", "garadagh", "garadag", "karadag"] },
  { slug: "xatai", name: "Xətai", keys: ["xetai", "khatai"] },
  { slug: "xazar", name: "Xəzər", keys: ["xezer", "khazar"] },
  { slug: "narimanov", name: "Nərimanov", keys: ["nerimanov", "narimanov"] },
  { slug: "nasimi", name: "Nəsimi", keys: ["nesimi", "nasimi"] },
  { slug: "nizami", name: "Nizami", keys: ["nizami"] },
  { slug: "pirallahi", name: "Pirallahı", keys: ["pirallahi"] },
  { slug: "sabuncu", name: "Sabunçu", keys: ["sabuncu", "sabunchu"] },
  { slug: "sabail", name: "Səbail", keys: ["sebail", "sabail"] },
  { slug: "suraxani", name: "Suraxanı", keys: ["suraxani", "surakhani"] },
  { slug: "yasamal", name: "Yasamal", keys: ["yasamal"] },
];

/** Same folding as the database function public.az_fold. */
export function azFold(input: string): string {
  const map: Record<string, string> = {
    Ə: "e", ə: "e", Ğ: "g", ğ: "g", I: "i", ı: "i", İ: "i",
    Ö: "o", ö: "o", Ü: "u", ü: "u", Ş: "s", ş: "s", Ç: "c", ç: "c",
  };
  return input.replace(/[ƏəĞğIıİÖöÜüŞşÇç]/g, (ch) => map[ch]).toLowerCase();
}

/**
 * Returns the district slug if the text is (or contains) exactly one district
 * name — e.g. "Nəsimi rayonu" or "Nasimi raion". Only use this on district /
 * administrative-area names, never on street addresses ("Nizami küçəsi").
 */
export function matchDistrict(text: string | undefined | null): string | null {
  if (!text) return null;
  const folded = azFold(text);
  const hits = DISTRICTS.filter((d) => d.keys.some((k) => new RegExp(`\\b${k}\\b`).test(folded)));
  return hits.length === 1 ? hits[0].slug : null;
}

export function districtName(slug: string): string | undefined {
  return DISTRICTS.find((d) => d.slug === slug)?.name;
}
