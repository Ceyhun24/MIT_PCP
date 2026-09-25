// Step 3: imports the reviewed CSV files into Supabase.
// Only run this AFTER the CSV files have been reviewed and approved.
//
//   npm run seed:import                 # dry run: shows what would happen
//   npm run seed:import -- --approved   # actually writes to the database
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
// Listings that were claimed by a provider or verified by an admin are never
// overwritten. Courses added by providers (no source_url) are kept.

import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Row } from "./lib/csv.ts";
import { loadAndValidate } from "./check.ts";
import { azFold } from "./lib/districts.ts";

const list = (v: string | undefined) => (v ?? "").split(";").map((s) => s.trim()).filter(Boolean);
const num = (v: string | undefined) => (v && v.trim() ? Number(v) : null);
const text = (v: string | undefined) => (v && v.trim() ? v.trim() : null);
const withScheme = (v: string | undefined) => (text(v) ? (/^https?:\/\//i.test(v!) ? v!.trim() : `https://${v!.trim()}`) : null);

export function slugify(name: string, externalId: string): string {
  const base = azFold(name).normalize("NFKD").toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").slice(0, 60) || "center";
  const suffix = externalId.replace(/[^0-9a-z]/gi, "").slice(-6).toLowerCase();
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

async function main() {
  const approved = process.argv.includes("--approved");
  const dir = process.argv.find((a, i) => i > 1 && !a.startsWith("--")) ?? join(process.cwd(), "data", "seed");
  const { centers, courses, issues } = loadAndValidate(dir);
  if (issues.length) {
    console.error(`${issues.length} problem(s) in the CSV files. Run "npm run seed:check" and fix them first.`);
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  const [{ data: districts, error: dErr }, { data: amenities, error: aErr }, { data: existing, error: eErr }] = await Promise.all([
    db.from("districts").select("id, slug"),
    db.from("amenities").select("id, slug"),
    db.from("centers").select("id, external_id, provider_id, verification_status").in("external_id", centers.map((c) => c.external_id)),
  ]);
  if (dErr || aErr || eErr) throw dErr ?? aErr ?? eErr;
  const districtIds = new Map(districts!.map((d) => [d.slug as string, d.id as number]));
  const amenityIds = new Map(amenities!.map((a) => [a.slug as string, a.id as number]));
  const existingById = new Map(existing!.map((e) => [e.external_id as string, e]));

  const protectedIds = new Set(
    existing!.filter((e) => e.provider_id || e.verification_status === "verified").map((e) => e.external_id as string),
  );
  const toWrite = centers.filter((c) => !protectedIds.has(c.external_id));
  console.log(`New: ${toWrite.filter((c) => !existingById.has(c.external_id)).length}, ` +
    `update: ${toWrite.filter((c) => existingById.has(c.external_id)).length}, ` +
    `skipped (claimed/verified): ${protectedIds.size}, courses: ${courses.filter((c) => !protectedIds.has(c.center_external_id)).length}`);

  if (!approved) {
    console.log('\nDry run only. Nothing was written. Re-run with "--approved" to import.');
    return;
  }

  for (const row of toWrite) {
    const payload = centerPayload(row, districtIds);
    const prev = existingById.get(row.external_id);
    // Keep an existing slug so public links stay stable.
    const { slug, ...rest } = payload;
    const { data, error } = prev
      ? await db.from("centers").update(rest).eq("id", prev.id).select("id").single()
      : await db.from("centers").insert({ ...rest, slug }).select("id").single();
    if (error) throw new Error(`${row.external_id}: ${error.message}`);
    const centerId = data.id as string;

    await db.from("center_amenities").delete().eq("center_id", centerId).not("source_url", "is", null);
    const amenityRows = list(row.amenities).map((s) => ({
      center_id: centerId, amenity_id: amenityIds.get(s)!, source_url: row.source_url, collected_at: row.collected_at,
    }));
    if (amenityRows.length) {
      const { error: amErr } = await db.from("center_amenities").upsert(amenityRows);
      if (amErr) throw new Error(`${row.external_id} amenities: ${amErr.message}`);
    }

    await db.from("courses").delete().eq("center_id", centerId).not("source_url", "is", null);
    const courseRows = courses.filter((c) => c.center_external_id === row.external_id).map((c) => ({
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
      if (cErr) throw new Error(`${row.external_id} courses: ${cErr.message}`);
    }
    console.log(`✓ ${row.name}`);
  }
  console.log("Import finished.");
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
