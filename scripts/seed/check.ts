// Step 2: checks the reviewed CSV files for mistakes. Changes nothing.
//   npm run seed:check

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv } from "./lib/csv.ts";
import { validateCenters, validateCourses } from "./lib/validate.ts";

export function loadAndValidate(dir: string) {
  const centers = parseCsv(readFileSync(join(dir, "centers.csv"), "utf8"));
  const courses = parseCsv(readFileSync(join(dir, "courses.csv"), "utf8"));
  const issues = [
    ...validateCenters(centers),
    ...validateCourses(courses, new Set(centers.map((c) => c.external_id))),
  ];
  return { centers, courses, issues };
}

if (import.meta.main) {
  const dir = process.argv[2] ?? join(process.cwd(), "data", "seed");
  const { centers, courses, issues } = loadAndValidate(dir);
  const empty = (f: string) => centers.filter((c) => !c[f]).length;
  console.log(`centers.csv: ${centers.length} rows (kindergartens: ${centers.filter((c) => c.type === "kindergarten").length}, ` +
    `training centers: ${centers.filter((c) => c.type === "training_center").length}); courses.csv: ${courses.length} rows`);
  console.log(`Empty values — district: ${empty("district")}, address: ${empty("address")}, phone: ${empty("phone")}, ` +
    `price: ${empty("price_min_azn")}, hours: ${empty("working_hours")}`);
  if (issues.length) {
    for (const i of issues) console.log(`✗ ${i.file} line ${i.line}: ${i.message}`);
    console.log(`\n${issues.length} problem(s) found. Fix them in the CSV and run again.`);
    process.exit(1);
  }
  console.log("✓ No problems found.");
}
