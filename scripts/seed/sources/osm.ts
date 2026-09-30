// Source 1: OpenStreetMap via the official Overpass API.
// Data © OpenStreetMap contributors, licensed under ODbL
// (https://www.openstreetmap.org/copyright) — attribution is shown on the site.

import type { PoliteClient } from "../lib/http.ts";
import { matchDistrict } from "../lib/districts.ts";
import type { CenterRecord, CenterType } from "../lib/record.ts";
import { setField } from "../lib/record.ts";

export const OVERPASS_URL = process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";

// OSM tags that identify each section.
const SECTION_FILTERS: Record<CenterType, string> = {
  kindergarten: `["amenity"="kindergarten"]`,
  training_center: `["amenity"~"^(language_school|training|music_school|dancing_school|prep_school|driving_school|tutoring)$"]`,
};

type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

async function overpass(client: PoliteClient, query: string): Promise<OsmElement[]> {
  const res = await client.fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const json = (await res.json()) as { elements?: OsmElement[] };
  return json.elements ?? [];
}

export function sectionQuery(type: CenterType, limit: number): string {
  return `[out:json][timeout:90];
area["ISO3166-2"="AZ-BA"]["boundary"="administrative"]->.baku;
nwr${SECTION_FILTERS[type]}["name"](area.baku);
out tags center ${limit};`;
}

function districtQuery(lat: number, lon: number): string {
  return `[out:json][timeout:30];
is_in(${lat},${lon})->.a;
area.a["boundary"="administrative"]["admin_level"~"^(5|6|7|8)$"];
out tags;`;
}

function first(tags: Record<string, string>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = tags[k]?.trim();
    if (v) return v;
  }
  return undefined;
}

function parseAge(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return /^\d{1,2}(\.\d)?$/.test(value.trim()) ? value.trim() : undefined;
}

/** Converts one OSM element to a record. Only copies values that are present. */
export function elementToRecord(el: OsmElement, type: CenterType, collectedAt: string): CenterRecord {
  const tags = el.tags ?? {};
  const sourceUrl = `https://www.openstreetmap.org/${el.type}/${el.id}`;
  const rec: CenterRecord = {
    external_id: `osm:${el.type}/${el.id}`,
    type,
    source_url: sourceUrl,
    collected_at: collectedAt,
    fields: {},
    field_sources: {},
    courses: [],
  };
  const put = (field: Parameters<typeof setField>[1], value: string | undefined) =>
    setField(rec, field, value, sourceUrl, collectedAt);

  put("name", first(tags, "name:az", "name"));
  const street = [first(tags, "addr:street"), first(tags, "addr:housenumber")].filter(Boolean).join(" ");
  put("address", first(tags, "addr:full") ?? (street || undefined));
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat !== undefined && lon !== undefined) {
    put("lat", lat.toFixed(6));
    put("lng", lon.toFixed(6));
  }
  put("phone", first(tags, "phone", "contact:phone"));
  put("email", first(tags, "email", "contact:email"));
  put("website", first(tags, "website", "contact:website", "url"));
  put("instagram", first(tags, "contact:instagram"));
  put("facebook", first(tags, "contact:facebook"));
  put("working_hours", first(tags, "opening_hours"));
  put("age_min_years", parseAge(tags["min_age"]));
  put("age_max_years", parseAge(tags["max_age"]));
  put("description", first(tags, "description:az", "description"));
  const district = matchDistrict(first(tags, "addr:district", "addr:suburb"));
  if (district) put("district", district);
  return rec;
}

export async function collectSection(
  client: PoliteClient,
  type: CenterType,
  limit: number,
  log: (msg: string) => void,
): Promise<CenterRecord[]> {
  const collectedAt = new Date().toISOString();
  const elements = await overpass(client, sectionQuery(type, limit));
  log(`OSM: ${elements.length} ${type} elements`);
  const records = elements.slice(0, limit).map((el) => elementToRecord(el, type, collectedAt));

  // Fill the district from the administrative area the point lies in.
  for (const rec of records) {
    if (rec.fields.district || !rec.fields.lat || !rec.fields.lng) continue;
    try {
      const areas = await overpass(client, districtQuery(Number(rec.fields.lat), Number(rec.fields.lng)));
      const slugs = new Set(
        areas
          .map((a) => matchDistrict(first(a.tags ?? {}, "name:az", "name")) ?? matchDistrict(a.tags?.["name:en"]))
          .filter((s): s is string => Boolean(s)),
      );
      if (slugs.size === 1) {
        const [slug] = slugs;
        setField(rec, "district", slug, rec.source_url, new Date().toISOString());
      }
    } catch (err) {
      log(`OSM district lookup failed for ${rec.external_id}: ${(err as Error).message}`);
    }
  }
  return records;
}
