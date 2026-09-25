// Unit tests for the seed pipeline. All inputs below are synthetic test
// fixtures (not real listings) and are never written to data/seed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, toCsv } from "../lib/csv.ts";
import { parseRobots } from "../lib/robots.ts";
import { PoliteClient, BlockedByRobotsError, MIN_DELAY_MS } from "../lib/http.ts";
import { matchDistrict, azFold } from "../lib/districts.ts";
import { elementToRecord, sectionQuery } from "../sources/osm.ts";
import { applyWebsiteData } from "../sources/website.ts";
import { centerToRow, CENTER_COLUMNS } from "../lib/record.ts";
import { validateCenters, validateCourses } from "../lib/validate.ts";
import { slugify, centerPayload } from "../import.ts";

test("CSV round-trips quotes, commas, newlines and Azerbaijani letters", () => {
  const rows = [{ a: 'Günəş "Bağça", MMC', b: "sətir 1\nsətir 2" }, { a: "", b: "şəkil" }];
  const parsed = parseCsv(toCsv(["a", "b"], rows));
  assert.deepEqual(parsed, rows);
});

test("robots.txt: longest rule wins, wildcards, agent groups", () => {
  const r = parseRobots(
    "User-agent: *\nDisallow: /private\nAllow: /private/ok\nDisallow: /*.pdf$\nCrawl-delay: 5\n\nUser-agent: OtherBot\nDisallow: /",
    "KursTap.az-seed/0.1",
  );
  assert.equal(r.isAllowed("/"), true);
  assert.equal(r.isAllowed("/private/x"), false);
  assert.equal(r.isAllowed("/private/ok/page"), true);
  assert.equal(r.isAllowed("/files/a.pdf"), false);
  assert.equal(r.crawlDelaySeconds, 5);
  assert.equal(parseRobots("User-agent: *\nDisallow: /", "x").isAllowed("/api"), false);
  assert.equal(parseRobots("User-agent: *\nDisallow:", "x").isAllowed("/api"), true);
});

function fakeClient(routes: Record<string, { status: number; body: string; type?: string }>) {
  let clock = 0;
  const calls: { url: string; at: number }[] = [];
  const client = new PoliteClient({
    userAgent: "test-bot",
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
    },
    fetchImpl: (async (url: string) => {
      calls.push({ url, at: clock });
      const r = routes[url] ?? { status: 404, body: "" };
      return new Response(r.body, { status: r.status, headers: { "content-type": r.type ?? "text/html" } });
    }) as unknown as typeof fetch,
  });
  return { client, calls };
}

test("polite client waits ≥ 2 s between requests to one domain", async () => {
  const { client, calls } = fakeClient({
    "https://a.test/robots.txt": { status: 200, body: "User-agent: *\nAllow: /" },
    "https://a.test/1": { status: 200, body: "one" },
    "https://a.test/2": { status: 200, body: "two" },
  });
  await client.fetch("https://a.test/1");
  await client.fetch("https://a.test/2");
  assert.deepEqual(calls.map((c) => c.url), ["https://a.test/robots.txt", "https://a.test/1", "https://a.test/2"]);
  for (let i = 1; i < calls.length; i++) assert.ok(calls[i].at - calls[i - 1].at >= MIN_DELAY_MS);
});

test("polite client refuses paths disallowed by robots.txt", async () => {
  const { client, calls } = fakeClient({
    "https://b.test/robots.txt": { status: 200, body: "User-agent: *\nDisallow: /" },
  });
  await assert.rejects(client.fetch("https://b.test/page"), BlockedByRobotsError);
  assert.equal(calls.length, 1); // only robots.txt was requested
});

test("district matching uses exact district names only", () => {
  assert.equal(matchDistrict("Nəsimi rayonu"), "nasimi");
  assert.equal(matchDistrict("Nasimi raion"), "nasimi");
  assert.equal(matchDistrict("Xətai"), "xatai");
  assert.equal(matchDistrict("Bakı"), null);
  assert.equal(matchDistrict(undefined), null);
  assert.equal(azFold("İÇƏRİŞƏHƏR"), "iceriseher");
});

test("OSM element → record copies only tags that exist and records sources", () => {
  const rec = elementToRecord(
    { type: "node", id: 42, lat: 40.38, lon: 49.85, tags: { name: "Test bağça", phone: "+994 12 555 55 55", "addr:street": "Test küç.", "addr:housenumber": "5" } },
    "kindergarten",
    "2026-09-25T10:00:00.000Z",
  );
  assert.equal(rec.external_id, "osm:node/42");
  assert.equal(rec.fields.name, "Test bağça");
  assert.equal(rec.fields.address, "Test küç. 5");
  assert.equal(rec.fields.price_min_azn, undefined);
  assert.equal(rec.fields.website, undefined);
  assert.equal(rec.field_sources.phone?.source_url, "https://www.openstreetmap.org/node/42");
  const row = centerToRow(rec);
  assert.equal(row.verification_status, "unverified");
  assert.equal(row.price_min_azn, "");
  assert.deepEqual(Object.keys(row).sort(), [...CENTER_COLUMNS].sort());
  assert.match(sectionQuery("kindergarten", 10), /out tags center 10;/);
});

test("website: reads JSON-LD, AZN course prices only, single tel link", () => {
  const rec = elementToRecord({ type: "node", id: 1, lat: 40.4, lon: 49.9, tags: { name: "X" } }, "training_center", "t");
  const html = `
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"EducationalOrganization",
      "telephone":"+994 50 000 00 00","openingHours":["Mo-Fr 09:00-18:00"],"sameAs":["https://instagram.com/x_test"]}</script>
    <script type="application/ld+json">[{"@type":"Course","name":"Riyaziyyat","offers":{"price":"120","priceCurrency":"AZN"}},
      {"@type":"Course","name":"Fizika","offers":{"price":"100","priceCurrency":"USD"}}]</script>
    <a href="tel:+994120000000">zəng</a> Qiymət: 999 AZN`;
  applyWebsiteData(rec, html, "https://x.test/", "2026-09-25T10:00:00.000Z");
  assert.equal(rec.fields.phone, "+994 50 000 00 00"); // JSON-LD first; tel: doesn't override
  assert.equal(rec.fields.working_hours, "Mo-Fr 09:00-18:00");
  assert.equal(rec.fields.instagram, "https://instagram.com/x_test");
  assert.equal(rec.fields.price_min_azn, undefined); // free text "999 AZN" is never used
  assert.deepEqual(rec.courses.map((c) => [c.name, c.price_azn]), [["Riyaziyyat", "120"], ["Fizika", undefined]]);
  assert.equal(rec.field_sources.phone?.source_url, "https://x.test/");
});

test("validation catches bad rows", () => {
  const good = { external_id: "osm:node/1", type: "kindergarten", name: "A", lat: "40.4", lng: "49.85", source_url: "https://www.openstreetmap.org/node/1", collected_at: "2026-09-25T10:00:00Z", field_sources: "{}" };
  assert.deepEqual(validateCenters([good]), []);
  const issues = validateCenters([{ ...good, type: "school", district: "moscow", price_min_azn: "abc", lat: "55.7", amenities: "pool" }, { ...good }]);
  const text = issues.map((i) => i.message).join("\n");
  for (const expected of ["type must be", "unknown district", "price_min_azn must be a number", "outside Baku", "unknown amenity", "duplicate external_id"]) {
    assert.match(text, new RegExp(expected));
  }
  assert.equal(validateCourses([{ center_external_id: "nope", name: "", source_url: "x", collected_at: "" }], new Set()).length, 4);
});

test("slugs are ASCII and stable", () => {
  assert.equal(slugify("Günəş Bağçası №5", "osm:node/123456789"), "gunes-bagcasi-no5-456789");
});

test("unreachable site is reported as unreachable, not fetched", async () => {
  const client = new PoliteClient({
    userAgent: "t",
    sleep: async () => {},
    fetchImpl: (async () => {
      throw new TypeError("fetch failed", { cause: new Error("ECONNREFUSED") });
    }) as unknown as typeof fetch,
  });
  await assert.rejects(client.fetch("https://down.test/x"), /cannot reach https:\/\/down\.test \(ECONNREFUSED\)/);
});

test("import payload: empty CSV cells become NULL, never 0 or guesses", () => {
  const p = centerPayload(
    { external_id: "osm:node/9", type: "kindergarten", name: " A ", lat: "40.4", lng: "49.85", district: "nasimi",
      price_min_azn: "", price_max_azn: "", website: "example.az", instagram: "", languages: "az;ru",
      source_url: "https://www.openstreetmap.org/node/9", collected_at: "2026-09-25T10:00:00Z", field_sources: "{}" },
    new Map([["nasimi", 6]]),
  );
  assert.equal(p.price_min_azn, null);
  assert.equal(p.age_min_years, null);
  assert.equal(p.phone, null);
  assert.equal(p.name, "A");
  assert.equal(p.district_id, 6);
  assert.equal(p.location, "SRID=4326;POINT(49.85 40.4)");
  assert.equal(p.website, "https://example.az");
  assert.deepEqual(p.social_links, {});
  assert.deepEqual(p.languages, ["az", "ru"]);
  assert.equal(p.verification_status, "unverified");
});
