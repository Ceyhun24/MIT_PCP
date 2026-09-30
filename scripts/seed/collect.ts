// Step 1 of the seed pipeline: collect public listing data into CSV files
// for human review. Does NOT touch the database.
//
//   npm run seed:collect                 # 10 per section (sample)
//   npm run seed:collect -- --limit 50   # more
//   npm run seed:collect -- --skip-websites --overwrite
//
// Output: data/seed/centers.csv, data/seed/courses.csv, data/seed/skipped_sources.csv

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { toCsv } from "./lib/csv.ts";
import { PoliteClient } from "./lib/http.ts";
import { CENTER_COLUMNS, COURSE_COLUMNS, centerToRow, coursesToRows, type CenterRecord, type CenterType } from "./lib/record.ts";
import { collectSection } from "./sources/osm.ts";
import { enrichFromWebsite, type Skipped } from "./sources/website.ts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const limit = Number(arg("limit") ?? 10);
  const outDir = arg("out") ?? join(process.cwd(), "data", "seed");
  const contact = process.env.SEED_CONTACT_EMAIL;
  if (!contact) {
    console.error("SEED_CONTACT_EMAIL is not set (see .env.example). Data providers ask for a contact address.");
    process.exit(1);
  }

  const files = {
    centers: join(outDir, "centers.csv"),
    courses: join(outDir, "courses.csv"),
    skipped: join(outDir, "skipped_sources.csv"),
  };
  if (!flag("overwrite") && (existsSync(files.centers) || existsSync(files.courses))) {
    console.error(`CSV files already exist in ${outDir}. They may contain your edits.\n` +
      "Rename them first, or re-run with --overwrite to replace them.");
    process.exit(1);
  }

  const client = new PoliteClient({ userAgent: `KursTap.az-seed/0.1 (+https://kurstap.az; mailto:${contact})` });
  const log = (msg: string) => console.log(msg);
  const records: CenterRecord[] = [];
  const skipped: Skipped[] = [];

  for (const type of ["kindergarten", "training_center"] as CenterType[]) {
    try {
      records.push(...(await collectSection(client, type, limit, log)));
    } catch (err) {
      console.error(`Failed to collect ${type} from OpenStreetMap: ${(err as Error).message}`);
      skipped.push({ url: "https://overpass-api.de/api/interpreter", center_external_id: "", reason: `${type}: ${(err as Error).message}` });
    }
  }

  if (!flag("skip-websites")) {
    for (const rec of records) await enrichFromWebsite(client, rec, skipped, log);
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(files.skipped, toCsv(["center_external_id", "url", "reason"], skipped));
  if (records.length === 0) {
    console.error(`\nNothing was collected, so no CSV files were written. See ${files.skipped}.`);
    process.exit(2);
  }
  writeFileSync(files.centers, toCsv(CENTER_COLUMNS, records.map(centerToRow)));
  writeFileSync(files.courses, toCsv(COURSE_COLUMNS, records.flatMap(coursesToRows)));

  const count = (t: CenterType) => records.filter((r) => r.type === t).length;
  console.log(`\nDone. Kindergartens: ${count("kindergarten")}, training centers: ${count("training_center")}, ` +
    `courses: ${records.reduce((n, r) => n + r.courses.length, 0)}, skipped sources: ${skipped.length}`);
  console.log(`Review ${files.centers} and ${files.courses}, then run: npm run seed:check`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
