// Search filters live in the URL (?q=…&type=…) so results can be shared and
// the back button works. This module converts between the URL and filters.

export type CenterType = "kindergarten" | "training_center";
export const RADIUS_OPTIONS = [1, 3, 5, 10] as const;
export const DEFAULT_RADIUS = 5;
export const PAGE_SIZE = 30;

export type Filters = {
  q?: string;
  type: CenterType;
  district?: string;
  priceMin?: number;
  priceMax?: number;
  age?: number;
  lang?: string;
  amenities: string[];
  lat?: number;
  lng?: number;
  radius?: number;
  page: number;
};

type Params = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const positive = (v: string | undefined, max: number) => {
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : undefined;
};
const slug = (v: string | undefined) => (v && /^[a-z_]{1,40}$/.test(v) ? v : undefined);

export function parseFilters(params: Params): Filters {
  const type = one(params.type);
  const lat = positive(one(params.lat), 90);
  const lng = positive(one(params.lng), 180);
  const radius = positive(one(params.r), 50);
  const hasOrigin = lat !== undefined && lng !== undefined;
  return {
    q: one(params.q)?.slice(0, 100),
    // Section toggle on the home page; defaults to kindergartens.
    type: type === "training_center" ? "training_center" : "kindergarten",
    district: slug(one(params.district)),
    priceMin: positive(one(params.pmin), 100000),
    priceMax: positive(one(params.pmax), 100000),
    age: positive(one(params.age), 99),
    lang: slug(one(params.lang)),
    amenities: (one(params.amen) ?? "").split(",").map((s) => slug(s.trim())).filter((s): s is string => Boolean(s)),
    lat: hasOrigin ? lat : undefined,
    lng: hasOrigin ? lng : undefined,
    radius: hasOrigin ? ((RADIUS_OPTIONS as readonly number[]).includes(radius ?? -1) ? radius : DEFAULT_RADIUS) : undefined,
    page: Math.max(1, Math.floor(positive(one(params.page), 10000) ?? 1)),
  };
}

export function filtersToQuery(f: Partial<Filters>): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.type === "training_center") p.set("type", f.type);
  if (f.district) p.set("district", f.district);
  if (f.priceMin !== undefined) p.set("pmin", String(f.priceMin));
  if (f.priceMax !== undefined) p.set("pmax", String(f.priceMax));
  if (f.age !== undefined) p.set("age", String(f.age));
  if (f.lang) p.set("lang", f.lang);
  if (f.amenities?.length) p.set("amen", f.amenities.join(","));
  if (f.lat !== undefined && f.lng !== undefined) {
    p.set("lat", f.lat.toFixed(5));
    p.set("lng", f.lng.toFixed(5));
    p.set("r", String(f.radius ?? DEFAULT_RADIUS));
  }
  if (f.page && f.page > 1) p.set("page", String(f.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Arguments for the database function public.search_centers. */
export function filtersToRpcArgs(f: Filters) {
  return {
    p_query: f.q ?? null,
    p_type: f.type,
    p_district_slug: f.district ?? null,
    p_price_min: f.priceMin ?? null,
    p_price_max: f.priceMax ?? null,
    p_age: f.age ?? null,
    p_language: f.lang ?? null,
    p_amenities: f.amenities.length ? f.amenities : null,
    p_lat: f.lat ?? null,
    p_lng: f.lng ?? null,
    p_radius_km: f.radius ?? null,
    p_limit: PAGE_SIZE,
    p_offset: (f.page - 1) * PAGE_SIZE,
  };
}
