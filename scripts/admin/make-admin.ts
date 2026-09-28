// Gives a person the site-admin role. They must have signed in once first.
//   npm run make-admin -- someone@example.com
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2]?.trim().toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!email) {
  console.error("Usage: npm run make-admin -- someone@example.com");
  process.exit(1);
}
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

let userId: string | undefined;
for (let page = 1; !userId; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
  if (data.users.length < 1000) break;
}
if (!userId) {
  console.error(`No account for ${email}. Sign in on the site once with this e-mail, then run this again.`);
  process.exit(1);
}
const { error } = await db.from("profiles").update({ role: "admin" }).eq("id", userId);
if (error) throw error;
console.log(`✓ ${email} is now a site admin.`);
