// Server-side data access for public pages.
import { getPublicClient } from "@/lib/supabase/public";
import { filtersToRpcArgs, type Filters } from "@/lib/search";
import { parseEwkbPoint } from "@/lib/geo";
import type { CenterDetail, Option, SearchResult } from "@/lib/types";

export type Loaded<T> = { ok: true; data: T } | { ok: false; error: "notConfigured" | "loadFailed" };

export async function searchCenters(filters: Filters): Promise<Loaded<{ results: SearchResult[]; total: number }>> {
  const db = getPublicClient();
  if (!db) return { ok: false, error: "notConfigured" };
  const { data, error } = await db.rpc("search_centers", filtersToRpcArgs(filters));
  if (error) {
    console.error("search_centers failed", error);
    return { ok: false, error: "loadFailed" };
  }
  const results = (data ?? []) as SearchResult[];
  return { ok: true, data: { results, total: results[0]?.total_count ?? 0 } };
}

export async function getFilterOptions(): Promise<{ districts: Option[]; amenities: string[] }> {
  const db = getPublicClient();
  if (!db) return { districts: [], amenities: [] };
  const [d, a] = await Promise.all([
    db.from("districts").select("slug, name").order("name"),
    db.from("amenities").select("slug").order("sort_order"),
  ]);
  return {
    districts: ((d.data ?? []) as Option[]).sort((x, y) => x.name.localeCompare(y.name, "az")),
    amenities: ((a.data ?? []) as { slug: string }[]).map((r) => r.slug),
  };
}

export async function getCenter(slug: string): Promise<Loaded<CenterDetail | null>> {
  const db = getPublicClient();
  if (!db) return { ok: false, error: "notConfigured" };
  const { data, error } = await db
    .from("centers")
    .select(
      `id, type, slug, name, description, address, location, phone, email, website, social_links, working_hours,
       age_min_years, age_max_years, price_min_azn, price_max_azn, languages, group_size_max,
       verification_status, rating_avg, rating_count, source_url, collected_at,
       district:districts(slug, name),
       courses(id, name, subject, level, age_min_years, age_max_years, duration, price_azn, price_period),
       center_amenities(amenities(slug, sort_order)),
       photos(id, storage_path, caption, sort_order)`,
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error("getCenter failed", error);
    return { ok: false, error: "loadFailed" };
  }
  if (!data) return { ok: true, data: null };
  const center = data as unknown as CenterDetail;
  const point = parseEwkbPoint(center.location);
  center.lat = point?.lat ?? null;
  center.lng = point?.lng ?? null;
  center.courses.sort((a, b) => a.name.localeCompare(b.name, "az"));
  center.photos.sort((a, b) => a.sort_order - b.sort_order);
  return { ok: true, data: center };
}
