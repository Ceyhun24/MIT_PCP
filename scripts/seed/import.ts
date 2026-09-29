// Step 3: imports the reviewed CSV files into Supabase.
// Only run this AFTER the CSV files have been reviewed and approved.
//
//   npm run seed:import                 # dry run: shows what would happen
//   npm run seed:import -- --approved   # actually writes to the database
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
// (Admins can also import from the website: /admin/idxal.)

import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadAndValidate } from "./check.ts";
import { runImport } from "./lib/importer.ts";

export { centerPayload, slugify } from "./lib/importer.ts";

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
  const result = await runImport(db, centers, courses, !approved);
  console.log(`New: ${result.create}, update: ${result.update}, skipped (claimed/verified): ${result.skippedProtected}, courses: ${result.courses}`);
  if (!approved) {
    console.log('\nDry run only. Nothing was written. Re-run with "--approved" to import.');
    return;
  }
  for (const name of result.done) console.log(`✓ ${name}`);
  for (const f of result.failed) console.log(`✗ ${f.name}: ${f.error}`);
  console.log("Import finished.");
  if (result.failed.length) process.exit(1);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
