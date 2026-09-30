// Checks that .env.local points to a correctly set-up Supabase project.
//   npm run check:supabase
// Prints only ✓ / ✗ lines — never the keys themselves.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let failures = 0;
const ok = (msg: string) => console.log(`✓ ${msg}`);
const bad = (msg: string, hint: string) => {
  failures++;
  console.log(`✗ ${msg}\n    → ${hint}`);
};

if (!url || !/^(https:\/\/[a-z0-9-]+\.supabase\.co|http:\/\/localhost:\d+)\/?$/.test(url)) {
  bad("NEXT_PUBLIC_SUPABASE_URL is missing or not like https://xxxx.supabase.co", "Supabase → Project Settings → API → Project URL");
}
if (!publicKey) bad("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing", "Supabase → Project Settings → API Keys → publishable (or anon) key");
if (!secretKey) bad("SUPABASE_SERVICE_ROLE_KEY is missing", "Supabase → Project Settings → API Keys → secret (or service_role) key");
if (failures) process.exit(1);

const pub = createClient(url!, publicKey!, { auth: { persistSession: false } });
const admin = createClient(url!, secretKey!, { auth: { persistSession: false } });

try {
  // 1. Tables exist (migration 1 ran) and the public key works.
  const { data: districts, error: dErr } = await pub.from("districts").select("slug");
  if (dErr) bad(`Cannot read tables with the public key: ${dErr.message}`, "Check the public key, and that migration 1 (…_init.sql) was run in the SQL Editor");
  else if (districts.length !== 12) bad(`Expected 12 districts, found ${districts.length}`, "Run supabase/migrations/20260925000001_init.sql in the SQL Editor");
  else ok("Connected with the public key; tables exist (12 districts)");

  // 2. Search function works.
  const { error: sErr } = await pub.rpc("search_centers", { p_type: "kindergarten", p_limit: 1 });
  if (sErr) bad(`Search does not work: ${sErr.message}`, "Re-run migration 1 in the SQL Editor");
  else ok("Search function works");

  // 3. Security: a visitor cannot add listings.
  const { error: rlsErr } = await pub.from("centers").insert({ type: "kindergarten", slug: "rls-check", name: "RLS check" });
  if (!rlsErr) {
    bad("A visitor could add a listing — security rules are NOT active", "Stop and contact the developer before going live");
    await admin.from("centers").delete().eq("slug", "rls-check");
  } else if (rlsErr.code === "42501" || /row-level security/i.test(rlsErr.message)) {
    ok("Security rules active (visitors cannot add listings)");
  } else bad(`Security check could not run: ${rlsErr.message}`, "Check the Project URL, public key and internet connection");

  // 4. The secret key works.
  const { error: nameErr } = await admin.from("profiles").select("id").limit(1);
  if (nameErr) bad(`Cannot read profiles with the secret key: ${nameErr.message}`, "Check the secret key");
  else ok("Secret key works");

  // 5. Photo storage (migration 2) and its limits.
  const { data: bucket, error: bErr } = await admin.storage.getBucket("center-photos");
  if (bErr || !bucket) bad("Photo storage bucket 'center-photos' not found", "Run supabase/migrations/20260925000002_storage.sql in the SQL Editor");
  else {
    ok("Photo storage bucket exists");
    if (!bucket.file_size_limit || !bucket.allowed_mime_types?.length) {
      bad("Photo limits not set on the bucket", "Storage → center-photos → Edit bucket: 5 MB, image/jpeg, image/png, image/webp (README Part 2, step 3)");
    } else ok(`Photo limits set (${Math.round(bucket.file_size_limit / 1024 / 1024)} MB, ${bucket.allowed_mime_types.join(", ")})`);
  }

  // 6. Sign-in service reachable with the secret key.
  const { error: aErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (aErr) bad(`Sign-in service check failed: ${aErr.message}`, "Check the secret key");
  else ok("Sign-in service reachable");
} catch (err) {
  bad(`Could not reach Supabase: ${(err as Error).message}`, "Check the Project URL and your internet connection");
}

console.log(failures ? `\n${failures} problem(s) found.` : "\nAll checks passed — Supabase is set up correctly.");
process.exit(failures ? 1 : 0);
