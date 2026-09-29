// Validates the reviewed CSV rows before anything goes into the database.

import type { Row } from "./csv.ts";
import { DISTRICTS } from "./districts.ts";

export const AMENITY_SLUGS = [
  "playground", "security_cameras", "meals", "transport", "medical_staff",
  "sports_hall", "swimming_pool", "garden", "parking",
] as const;

export const LANGUAGE_CODES = ["az", "ru", "en", "tr", "de", "fr", "ar", "fa", "zh", "ko", "ja", "es", "it"] as const;

// Generous box around Baku incl. Absheron settlements and Pirallahı.
const BAKU_BOUNDS = { latMin: 39.95, latMax: 40.7, lngMin: 49.3, lngMax: 50.7 };

const isNumber = (v: string) => /^\d+(\.\d+)?$/.test(v.trim());
const isUrl = (v: string) => {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};
const isDate = (v: string) => !Number.isNaN(Date.parse(v));
const list = (v: string) => v.split(";").map((s) => s.trim()).filter(Boolean);

/** `code` + `params` let the admin page translate the message; `message` is the English text for the CLI. */
export type Issue = { file: string; line: number; code: string; params: Record<string, string>; message: string };

export function validateCenters(rows: Row[], file = "centers.csv"): Issue[] {
  const issues: Issue[] = [];
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    const line = i + 2; // header is line 1
    const bad = (code: string, message: string, params: Record<string, string> = {}) => issues.push({ file, line, code, params, message });
    if (!r.external_id) bad("emptyExternalId", "external_id is empty");
    else if (seen.has(r.external_id)) bad("duplicateExternalId", `duplicate external_id ${r.external_id}`, { value: r.external_id });
    seen.add(r.external_id);
    if (r.type !== "kindergarten" && r.type !== "training_center") bad("badType", `type must be kindergarten or training_center, got "${r.type}"`, { value: r.type ?? "" });
    if (r.verification_status && !["unverified", "verified"].includes(r.verification_status)) bad("badVerification", "verification_status must be unverified or verified");
    if (!r.name?.trim()) bad("emptyName", "name is empty");
    if (r.district && !DISTRICTS.some((d) => d.slug === r.district)) bad("unknownDistrict", `unknown district "${r.district}" (use one of: ${DISTRICTS.map((d) => d.slug).join(", ")})`, { value: r.district });
    if (Boolean(r.lat) !== Boolean(r.lng)) bad("latLngPair", "lat and lng must both be filled or both empty");
    if (r.lat && r.lng) {
      if (!/^-?\d+(\.\d+)?$/.test(r.lat) || !/^-?\d+(\.\d+)?$/.test(r.lng)) bad("latLngNumber", "lat/lng must be numbers");
      else {
        const lat = Number(r.lat), lng = Number(r.lng);
        if (lat < BAKU_BOUNDS.latMin || lat > BAKU_BOUNDS.latMax || lng < BAKU_BOUNDS.lngMin || lng > BAKU_BOUNDS.lngMax) bad("outsideBaku", `location ${lat},${lng} is outside Baku`, { value: `${lat},${lng}` });
      }
    }
    for (const f of ["age_min_years", "age_max_years", "price_min_azn", "price_max_azn", "group_size_max"]) {
      if (r[f] && !isNumber(r[f])) bad("notNumber", `${f} must be a number, got "${r[f]}"`, { field: f, value: r[f] });
    }
    if (r.price_min_azn && r.price_max_azn && Number(r.price_min_azn) > Number(r.price_max_azn)) bad("priceOrder", "price_min_azn is greater than price_max_azn");
    if (r.age_min_years && r.age_max_years && Number(r.age_min_years) > Number(r.age_max_years)) bad("ageOrder", "age_min_years is greater than age_max_years");
    for (const code of list(r.languages ?? "")) if (!(LANGUAGE_CODES as readonly string[]).includes(code)) bad("unknownLanguage", `unknown language code "${code}"`, { value: code });
    for (const slug of list(r.amenities ?? "")) if (!(AMENITY_SLUGS as readonly string[]).includes(slug)) bad("unknownAmenity", `unknown amenity "${slug}"`, { value: slug });
    for (const f of ["website", "instagram", "facebook"]) if (r[f] && !isUrl(r[f]) && !isUrl(`https://${r[f]}`)) bad("badLink", `${f} is not a valid link`, { field: f });
    if (!r.source_url || !isUrl(r.source_url)) bad("badSourceUrl", "source_url is missing or invalid");
    if (!r.collected_at || !isDate(r.collected_at)) bad("badCollectedAt", "collected_at is missing or not a date");
    if (r.field_sources) {
      try {
        const fs = JSON.parse(r.field_sources);
        if (typeof fs !== "object" || fs === null || Array.isArray(fs)) throw new Error();
      } catch {
        bad("badFieldSources", "field_sources is not valid JSON");
      }
    }
  });
  return issues;
}

export function validateCourses(rows: Row[], centerIds: Set<string>, file = "courses.csv"): Issue[] {
  const issues: Issue[] = [];
  rows.forEach((r, i) => {
    const line = i + 2;
    const bad = (code: string, message: string, params: Record<string, string> = {}) => issues.push({ file, line, code, params, message });
    if (!centerIds.has(r.center_external_id)) bad("unknownCenter", `center_external_id "${r.center_external_id}" not found in centers.csv`, { value: r.center_external_id ?? "" });
    if (!r.name?.trim()) bad("emptyName", "name is empty");
    for (const f of ["age_min_years", "age_max_years", "price_azn"]) if (r[f] && !isNumber(r[f])) bad("notNumber", `${f} must be a number, got "${r[f]}"`, { field: f, value: r[f] });
    if (r.price_period && !["month", "lesson", "total"].includes(r.price_period)) bad("badPricePeriod", "price_period must be month, lesson or total");
    if (!r.source_url || !isUrl(r.source_url)) bad("badSourceUrl", "source_url is missing or invalid");
    if (!r.collected_at || !isDate(r.collected_at)) bad("badCollectedAt", "collected_at is missing or not a date");
  });
  return issues;
}
