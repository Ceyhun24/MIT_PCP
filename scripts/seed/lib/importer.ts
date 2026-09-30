// Shared import logic, used by the command-line import (service key) and the
// admin "Import" page (signed-in admin; RLS allows admins to write).
// Listings claimed by a provider or verified by an admin are never overwritten.
// Courses and amenities added by providers (no source_url) are kept.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Row } from "./csv.ts";
import { azFold } from "./districts.ts";

const list = (v: string | undefined) => (v ?? "").split(";").map((s) => s.trim()).filter(Boolean);
const num = (v: string | undefined) => (v && v.trim() ? Number(v) : null);
const text = (v: string | undefined) => (v && v.trim() ? v.trim() : null);
const withScheme = (v: string | undefined) => (text(v) ? (/^https?:\/\//i.test(v!) ? v!.trim() : `https://${v!.trim()}`) : null);

export function slugify(name: string, uniqueSuffix: string): string {
  const base = azFold(name).normalize("NFKD").toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").slice(0, 60) || "center";
  const suffix = uniqueSuffix.replace(/[^0-9a-z]/gi, "").slice(-6).toLowerCase();
  return `${base}-${suffix}`;
}

export function centerPayload(r: Row, districtIds: Map<string, number>) {
  const social: Record<string, string> = {};
  if (text(r.instagram)) social.instagram = withScheme(r.instagram)!;
  if (text(r.facebook)) social.facebook = withScheme(r.facebook)!;
  return {
    external_id: r.external_id,
    type: r.type,
    slug: slugify(r.name, r.external_id),
    name: r.name.trim(),
    description: text(r.description),
    district_id: r.district ? districtIds.get(r.district) ?? null : null,
    address: text(r.address),
    location: r.lat && r.lng ? `SRID=4326;POINT(${Number(r.lng)} ${Number(r.lat)})` : null,
    phone: text(r.phone),
    email: text(r.email),
    website: withScheme(r.website),
    social_links: social,
    working_hours: text(r.working_hours),
    age_min_years: num(r.age_min_years),
    age_max_years: num(r.age_max_years),
    price_min_azn: num(r.price_min_azn),
    price_max_azn: num(r.price_max_azn),
    languages: list(r.languages),
    group_size_max: num(r.group_size_max),
    verification_status: "unverified",
    source_url: r.source_url,
    collected_at: r.collected_at,
    field_sources: r.field_sources ? JSON.parse(r.field_sources) : {},
  };
}

export type ImportPlan = { create: number; update: number; skippedProtected: number; courses: number };
export type ImportResult = ImportPlan & { done: string[]; failed: { name: string; error: string }[] };

/** Validated CSV rows in; writes to the database unless dryRun. */
export async function runImport(db: SupabaseClient, centers: Row[], courses: Row[], dryRun: boolean): Promise<ImportResult> {
  const [{ data: districts, error: dErr }, { data: amenities, error: aErr }, { data: existing, error: eErr }] = await Promise.all([
    db.from("districts").select("id, slug"),
    db.from("amenities").select("id, slug"),
    db.from("centers").select("id, external_id, provider_id, verification_status").in("external_id", centers.map((c) => c.external_id)),
  ]);
  if (dErr || aErr || eErr) throw dErr ?? aErr ?? eErr;
  const districtIds = new Map(districts!.map((d) => [d.slug as string, d.id as number]));
  const amenityIds = new Map(amenities!.map((a) => [a.slug as string, a.id as number]));
  const existingById = new Map(existing!.map((e) => [e.external_id as string, e]));
  const protectedIds = new Set(existing!.filter((e) => e.provider_id || e.verification_status === "verified").map((e) => e.external_id as string));
  const toWrite = centers.filter((c) => !protectedIds.has(c.external_id));

  const result: ImportResult = {
    create: toWrite.filter((c) => !existingById.has(c.external_id)).length,
    update: toWrite.filter((c) => existingById.has(c.external_id)).length,
    skippedProtected: protectedIds.size,
    courses: courses.filter((c) => !protectedIds.has(c.center_external_id)).length,
    done: [],
    failed: [],
  };
  if (dryRun) return result;

  for (const row of toWrite) {
    try {
      const payload = centerPayload(row, districtIds);
      const prev = existingById.get(row.external_id);
      const { slug, ...rest } = payload; // keep an existing slug so public links stay stable
      const { data, error } = prev
        ? await db.from("centers").update(rest).eq("id", prev.id).select("id").single()
        : await db.from("centers").insert({ ...rest, slug }).select("id").single();
      if (error) throw error;
      const centerId = data.id as string;

      await db.from("center_amenities").delete().eq("center_id", centerId).not("source_url", "is", null);
      const amenityRows = list(row.amenities).map((s) => ({ center_id: centerId, amenity_id: amenityIds.get(s)!, source_url: row.source_url, collected_at: row.collected_at }));
      if (amenityRows.length) {
        const { error: amErr } = await db.from("center_amenities").upsert(amenityRows);
        if (amErr) throw amErr;
      }

      await db.from("courses").delete().eq("center_id", centerId).not("source_url", "is", null);
      const courseRows = courses
        .filter((c) => c.center_external_id === row.external_id)
        .map((c) => ({
          center_id: centerId,
          name: c.name.trim(),
          subject: text(c.subject),
          level: text(c.level),
          age_min_years: num(c.age_min_years),
          age_max_years: num(c.age_max_years),
          duration: text(c.duration),
          price_azn: num(c.price_azn),
          price_period: text(c.price_period),
          source_url: c.source_url,
          collected_at: c.collected_at,
        }));
      if (courseRows.length) {
        const { error: cErr } = await db.from("courses").insert(courseRows);
        if (cErr) throw cErr;
      }
      result.done.push(row.name);
    } catch (err) {
      result.failed.push({ name: row.name, error: (err as { message?: string }).message ?? String(err) });
    }
  }
  return result;
}
