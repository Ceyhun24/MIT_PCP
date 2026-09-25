// Source 2: the center's own official website (only the URL listed in OSM).
// Reads only machine-readable, unambiguous data:
//   - schema.org JSON-LD (telephone, email, openingHours, address, sameAs, Course + AZN offers)
//   - a single distinct "tel:" link, and links to Instagram/Facebook pages
// Nothing is inferred from free text, so prices appear only when the site
// publishes them as structured data in AZN.

import { BlockedByRobotsError, SiteUnreachableError, type PoliteClient } from "../lib/http.ts";
import type { CenterRecord, CourseRecord } from "../lib/record.ts";
import { setField } from "../lib/record.ts";

export type Skipped = { url: string; center_external_id: string; reason: string };

type Json = Record<string, unknown>;

export function extractJsonLd(html: string): Json[] {
  const out: Json[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const stack: unknown[] = [parsed];
      while (stack.length) {
        const item = stack.shift();
        if (Array.isArray(item)) stack.push(...item);
        else if (item && typeof item === "object") {
          out.push(item as Json);
          const graph = (item as Json)["@graph"];
          if (graph) stack.push(graph);
          for (const key of ["hasOfferCatalog", "itemListElement", "itemOffered", "subOrganization"]) {
            if ((item as Json)[key]) stack.push((item as Json)[key]);
          }
        }
      }
    } catch {
      // Invalid JSON-LD is ignored.
    }
  }
  return out;
}

function types(obj: Json): string[] {
  const t = obj["@type"];
  return (Array.isArray(t) ? t : [t]).filter((x): x is string => typeof x === "string");
}

function str(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number") return String(v);
  return undefined;
}

const ORG_TYPES = new Set([
  "Preschool", "ChildCare", "School", "EducationalOrganization", "LocalBusiness", "Organization",
  "ElementarySchool", "HighSchool", "CollegeOrUniversity",
]);

function formatAddress(a: unknown): string | undefined {
  if (typeof a === "string") return str(a);
  if (a && typeof a === "object") return str((a as Json).streetAddress);
  return undefined;
}

function aznPrice(offers: unknown): string | undefined {
  const list = Array.isArray(offers) ? offers : offers ? [offers] : [];
  for (const o of list) {
    if (!o || typeof o !== "object") continue;
    const currency = str((o as Json).priceCurrency)?.toUpperCase();
    const price = str((o as Json).price);
    if (currency === "AZN" && price && /^\d+(\.\d+)?$/.test(price)) return price;
  }
  return undefined;
}

export function applyWebsiteData(rec: CenterRecord, html: string, pageUrl: string, collectedAt: string) {
  const blocks = extractJsonLd(html);
  const put = (field: Parameters<typeof setField>[1], value: string | undefined) =>
    setField(rec, field, value, pageUrl, collectedAt);

  for (const obj of blocks.filter((b) => types(b).some((t) => ORG_TYPES.has(t)))) {
    put("phone", str(obj.telephone));
    put("email", str(obj.email)?.replace(/^mailto:/i, ""));
    const hours = obj.openingHours;
    put("working_hours", Array.isArray(hours) ? hours.filter((h) => typeof h === "string").join("; ") : str(hours));
    put("address", formatAddress(obj.address));
    const sameAs = Array.isArray(obj.sameAs) ? obj.sameAs : [obj.sameAs];
    for (const link of sameAs.map(str).filter(Boolean) as string[]) {
      if (/instagram\.com\//i.test(link)) put("instagram", link);
      if (/facebook\.com\//i.test(link)) put("facebook", link);
    }
  }

  for (const obj of blocks.filter((b) => types(b).includes("Course"))) {
    const name = str(obj.name);
    if (!name) continue;
    const course: CourseRecord = { name, source_url: pageUrl, collected_at: collectedAt };
    const price = aznPrice(obj.offers);
    if (price) course.price_azn = price;
    const subject = str(obj.about) ?? str((obj.about as Json | undefined)?.name);
    if (subject) course.subject = subject;
    const level = str(obj.educationalLevel);
    if (level) course.level = level;
    const duration = str(obj.timeRequired);
    if (duration) course.duration = duration;
    if (!rec.courses.some((c) => c.name === name)) rec.courses.push(course);
  }

  // A single distinct tel: link is unambiguous; several (branches) are not.
  const tels = new Set(
    [...html.matchAll(/href=["']tel:([^"']+)["']/gi)].map((m) => decodeURIComponent(m[1]).replace(/[^\d+]/g, "")),
  );
  if (tels.size === 1) put("phone", [...tels][0]);

  const instagram = new Set(
    [...html.matchAll(/href=["'](https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.]+\/?)["']/gi)].map((m) => m[1]),
  );
  if (instagram.size === 1) put("instagram", [...instagram][0]);
  const facebook = new Set(
    [...html.matchAll(/href=["'](https?:\/\/(?:www\.|m\.)?facebook\.com\/[A-Za-z0-9_.\-]+\/?)["']/gi)]
      .map((m) => m[1])
      .filter((u) => !/facebook\.com\/(sharer|share|plugins|dialog|tr)\b/i.test(u)),
  );
  if (facebook.size === 1) put("facebook", [...facebook][0]);
}

// Social networks and map/listing platforms forbid automated collection in
// their terms of service: their links are recorded, never fetched.
const NO_FETCH_HOSTS = /(^|\.)(instagram\.com|facebook\.com|fb\.com|tiktok\.com|google\.[a-z.]+|goo\.gl|wa\.me|whatsapp\.com|t\.me|tap\.az|boss\.az|2gis\.[a-z.]+|yandex\.[a-z.]+)$/i;

export async function enrichFromWebsite(
  client: PoliteClient,
  rec: CenterRecord,
  skipped: Skipped[],
  log: (msg: string) => void,
) {
  const raw = rec.fields.website;
  if (!raw) return;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    skipped.push({ url: raw, center_external_id: rec.external_id, reason: "invalid URL" });
    return;
  }
  if (NO_FETCH_HOSTS.test(url.hostname)) {
    if (/instagram\.com/i.test(url.hostname)) setField(rec, "instagram", url.href, rec.source_url, rec.collected_at);
    if (/facebook\.com|fb\.com/i.test(url.hostname)) setField(rec, "facebook", url.href, rec.source_url, rec.collected_at);
    skipped.push({ url: url.href, center_external_id: rec.external_id, reason: "platform terms forbid automated collection — enter manually" });
    return;
  }
  try {
    const res = await client.fetch(url.href, { headers: { Accept: "text/html" } });
    const collectedAt = new Date().toISOString();
    if (!res.ok) {
      skipped.push({ url: url.href, center_external_id: rec.external_id, reason: `HTTP ${res.status}` });
      return;
    }
    if (!(res.headers.get("content-type") ?? "").includes("html")) {
      skipped.push({ url: url.href, center_external_id: rec.external_id, reason: "not an HTML page" });
      return;
    }
    const html = (await res.text()).slice(0, 2_000_000);
    applyWebsiteData(rec, html, res.url || url.href, collectedAt);
    log(`website ok: ${url.href}`);
  } catch (err) {
    const reason =
      err instanceof BlockedByRobotsError ? "robots.txt disallows — enter manually"
      : err instanceof SiteUnreachableError ? `unreachable: ${err.message}`
      : `error: ${(err as Error).message}`;
    skipped.push({ url: url.href, center_external_id: rec.external_id, reason });
  }
}
