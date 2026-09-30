// In-memory shape of a collected listing and its conversion to CSV rows.

import type { Row } from "./csv.ts";

export type CenterType = "kindergarten" | "training_center";

export const CENTER_FIELDS = [
  "name",
  "district", // district slug, e.g. "nasimi"
  "address",
  "lat",
  "lng",
  "phone",
  "email",
  "website",
  "instagram",
  "facebook",
  "working_hours",
  "age_min_years",
  "age_max_years",
  "price_min_azn",
  "price_max_azn",
  "languages", // ";"-separated codes: az;ru;en
  "group_size_max",
  "amenities", // ";"-separated slugs: playground;meals
  "description",
] as const;
export type CenterField = (typeof CENTER_FIELDS)[number];

export const CENTER_COLUMNS = [
  "external_id",
  "type",
  "verification_status",
  ...CENTER_FIELDS,
  "source_url",
  "collected_at",
  "field_sources",
] as const;

export const COURSE_FIELDS = [
  "name",
  "subject",
  "level",
  "age_min_years",
  "age_max_years",
  "duration",
  "price_azn",
  "price_period", // month | lesson | total
] as const;
export type CourseField = (typeof COURSE_FIELDS)[number];

export const COURSE_COLUMNS = ["center_external_id", ...COURSE_FIELDS, "source_url", "collected_at"] as const;

export type Source = { source_url: string; collected_at: string };

export type CourseRecord = Partial<Record<CourseField, string>> & Source;

export type CenterRecord = {
  external_id: string;
  type: CenterType;
  /** Where the record was first found. */
  source_url: string;
  collected_at: string;
  fields: Partial<Record<CenterField, string>>;
  /** Per-field provenance: which page each value came from, and when. */
  field_sources: Partial<Record<CenterField, Source>>;
  courses: CourseRecord[];
};

/** Sets a field only if the value is non-empty and the field is still empty. */
export function setField(
  rec: CenterRecord,
  field: CenterField,
  value: string | undefined | null,
  sourceUrl: string,
  collectedAt: string,
): boolean {
  const v = value?.trim();
  if (!v || rec.fields[field]) return false;
  rec.fields[field] = v;
  rec.field_sources[field] = { source_url: sourceUrl, collected_at: collectedAt };
  return true;
}

export function centerToRow(rec: CenterRecord): Row {
  const row: Row = {
    external_id: rec.external_id,
    type: rec.type,
    verification_status: "unverified",
    source_url: rec.source_url,
    collected_at: rec.collected_at,
    field_sources: JSON.stringify(rec.field_sources),
  };
  for (const f of CENTER_FIELDS) row[f] = rec.fields[f] ?? "";
  return row;
}

export function coursesToRows(rec: CenterRecord): Row[] {
  return rec.courses.map((c) => {
    const row: Row = { center_external_id: rec.external_id, source_url: c.source_url, collected_at: c.collected_at };
    for (const f of COURSE_FIELDS) row[f] = c[f] ?? "";
    return row;
  });
}
