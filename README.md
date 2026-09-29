# KursTap.az

A website where parents and learners in Baku find **kindergartens (bağçalar)** and
**training centers (tədris mərkəzləri)**: search, filters, "near me", a map, listing pages,
reviews, a panel for centers to manage their own listing, and an admin panel for you.

- Everything visitors see is in Azerbaijani (all texts are in `src/locales/az.json`).
- Prices are in AZN (₼).
- Built with: Next.js + Tailwind (the website), Supabase (database, sign-in, photo storage),
  Leaflet + OpenStreetMap (maps, no paid keys).

This guide is written for a non-programmer. Follow the parts in order the first time.

---

## Part 1 — What the site can do

| Page | Who | What |
|---|---|---|
| `/` | everyone | Switch between **Bağçalar / Tədris mərkəzləri**, search by name, course or subject, filters (district, price, age, language, amenities), **📍 Yaxınlığımda** (near me, 1/3/5/10 km), results as list + map |
| `/merkez/…` | everyone | One listing: contacts, hours, ages, prices, languages, amenities, courses, photos, map, reviews |
| `/giris` | everyone | Sign in with an e-mail link (no password) |
| `/panel` | providers | **Mərkəzlərim** — the provider's centers and claims |
| `/panel/merkez/…` | provider (own centers) or admin | Edit details, map pin, prices, amenities, courses, photos; reply to reviews |
| `/admin` | admin | Overview, **Müraciətlər** (claims), **Rəylərin moderasiyası** (reviews), **Mərkəzlər** (all listings), **Məlumat idxalı** (import) |

Rules that the database itself enforces (not just the website):
- A review is visible only after an admin approves it; one review per person per center.
- A provider can edit **only** their own centers, can reply to reviews, and can never edit or delete a review.
- Listings collected from the internet show **"Təsdiqlənməyib"** (unverified) until a provider claims them or an admin marks them verified.

---

## Part 2 — One-time setup of Supabase (about 30 minutes)

Supabase stores the data, sends sign-in e-mails and keeps photos.

1. **Create a project** at <https://supabase.com> → *New project*. Choose a region close to Baku
   (e.g. *Frankfurt*). Save the database password somewhere safe.
2. **Create the tables.** In the project open **SQL Editor** → *New query*. Open each file below
   from this project, copy all its text, paste, press **Run**. Do them **in this order**, one at a time:
   1. `supabase/migrations/20260925000001_init.sql`
   2. `supabase/migrations/20260925000002_storage.sql`
   3. `supabase/migrations/20260928000001_profile_display_name.sql`

   Each should end with "Success". If one fails, stop and send me the error.
3. **Photo limits.** **Storage** → bucket **center-photos** → *Edit bucket*: set
   *File size limit* to **5 MB** and *Allowed MIME types* to `image/jpeg, image/png, image/webp`.
4. **Sign-in settings.** **Authentication → URL Configuration**:
   - *Site URL*: `http://localhost:3000` for now (you change it to `https://kurstap.az` in Part 6).
   - *Redirect URLs*: add `http://localhost:3000/auth/callback` (and later `https://kurstap.az/auth/callback`).
5. **Azerbaijani e-mails.** **Authentication → Emails**: replace the *Magic Link* and *Confirm signup*
   templates with the texts in `supabase/email-templates/` (subjects are listed in the README there).
6. **E-mail sending (before real users).** Supabase's built-in e-mail only allows a few e-mails per hour —
   fine for testing, not for launch. Under **Authentication → Emails → SMTP settings** connect an
   e-mail service (for example Resend or Brevo; both have free tiers). *Ask me before adding one if you want help.*
7. **Copy the keys.** **Project Settings → API**: you need the *Project URL*, the *anon / public* key and
   the *service_role* key (secret!).

---

## Part 3 — Run the site on your computer

1. Install **Node.js 22 (LTS) or newer** from <https://nodejs.org>.
2. Download this project (GitHub → *Code* → *Download ZIP*, or `git clone`), open a terminal in its folder.
3. Copy `.env.example` to a new file named `.env.local` and fill it in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=      ← Project URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY= ← anon / public key
   SUPABASE_SERVICE_ROLE_KEY=     ← service_role key (never share, never put on the website)
   SEED_CONTACT_EMAIL=            ← your e-mail (sent with data-collection requests)
   ```
   `.env.local` is never uploaded to GitHub.
4. In the terminal:
   ```
   npm install
   npm run dev
   ```
   Open <http://localhost:3000>.

**Make yourself admin:** sign in once on the site with your e-mail (click the link you receive), then run
```
npm run make-admin -- your@email.com
```
Refresh the page — **Admin** appears in the top menu.

---

## Part 4 — Adding data

### A. From public sources (recommended start)

```
npm run seed:collect                # 10 kindergartens + 10 training centers (a sample)
npm run seed:collect -- --limit 100 # more
```
This reads OpenStreetMap and the centers' own official websites, politely (robots.txt respected,
max 1 request per 2 seconds per site). It **never guesses**: anything not found stays empty. Result:

- `data/seed/centers.csv`, `data/seed/courses.csv` — open in Excel / Google Sheets, check and correct.
- `data/seed/skipped_sources.csv` — pages it was not allowed to read (e.g. Instagram) — fill in by hand if you want.

Column meanings: `data/seed/README.md`. Sources and rules: `docs/data-sources.md`.

Then:
```
npm run seed:check        # finds mistakes in the CSV files; changes nothing
```
and import — either in the browser (**Admin → Məlumat idxalı**: choose the files, press **Yoxla**, then
**İdxal et**) or in the terminal:
```
npm run seed:import                 # shows what would change; writes nothing
npm run seed:import -- --approved   # writes to the database
```
Listings already claimed by a provider or verified by you are never overwritten by an import.

### B. By hand
**Admin → Mərkəzlər → Yeni mərkəz**, then fill in the form.

### C. By the centers themselves
A center opens its page and presses **«İdarəetmə üçün müraciət et»**. You see it in
**Admin → Müraciətlər**; if in doubt, call the center's official number, then **Təsdiqlə**.
The center can now keep its own prices, courses and photos up to date.

---

## Part 5 — Your regular admin tasks

- **Admin → Rəylərin moderasiyası**: approve or reject new reviews (approved ones appear on the site; editing sends a review back here).
- **Admin → Müraciətlər**: approve or reject centers asking to manage their listing.
- **Admin → Mərkəzlər**: fix mistakes, **Gizlət** (hide) a listing that closed or is wrong, **Göstər** to show it again.

---

## Part 6 — Put the site on the internet (Vercel + Supabase)

> Nothing has been deployed yet. Do this when you are ready — or ask me to walk you through it.

1. Put the project on GitHub (it already is: the branch with this code).
2. Go to <https://vercel.com>, sign in with GitHub → **Add New… → Project** → pick this repository.
3. Under **Environment Variables** add only these two:
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   (**Do not** add the service_role key to Vercel — the website does not need it.)
4. Press **Deploy**. After a few minutes you get an address like `kurstap.vercel.app`.
5. **Your domain:** Vercel → project → **Settings → Domains** → add `kurstap.az`, then set the DNS
   records it shows at the company where you bought the domain.
6. **Tell Supabase the new address:** Authentication → URL Configuration → *Site URL* =
   `https://kurstap.az`, and add `https://kurstap.az/auth/callback` to *Redirect URLs*.
7. Test: sign in, write a review, approve it.

Every new change pushed to GitHub is deployed by Vercel automatically.

### Costs and limits to know
- **Supabase free plan**: enough for the start (500 MB database, 1 GB photos). Free projects are
  *paused after about a week without visitors* — the paid plan (about $25/month) avoids that.
- **Vercel**: the free *Hobby* plan is for non-commercial use. A business site should use *Pro* (about $20/month).
- **Maps**: the free OpenStreetMap map server is fine for a modest number of visitors; if the site gets
  busy, switching to another map-tile provider may be needed.
- **E-mail**: see Part 2, step 6.

Prices change — check the providers' pricing pages.

---

## Part 7 — If something goes wrong

| You see | Likely reason | What to do |
|---|---|---|
| "Verilənlər bazası hələ qoşulmayıb" | `.env.local` (or Vercel variables) missing | Fill in the two `NEXT_PUBLIC_…` values, restart |
| Sign-in link says "Link etibarsızdır" | Link older than an hour or already used, or the address is missing in *Redirect URLs* | Ask for a new link; check Part 2 step 4 / Part 6 step 6 |
| No sign-in e-mail arrives | Supabase built-in e-mail limit | Wait, or set up SMTP (Part 2 step 6) |
| "Bu səhifə yalnız administratorlar üçündür" | Your account is not admin | `npm run make-admin -- your@email.com` |
| `seed:collect` says "cannot reach" | No internet / site blocked | Check the connection and try again later |

---

## For developers

| Command | What it does |
|---|---|
| `npm run dev` / `npm run build` | Run / build the site |
| `npm run typecheck`, `npm run lint` | Code checks |
| `npm test` | Seed pipeline unit tests |
| `npm run db:test` | Migrations + 34 security/search checks on a local Postgres+PostGIS (`TEST_DATABASE_URL`) |
| `npm run db:dev` | Local Supabase stand-in with FAKE "TEST" listings (Postgres+PostGIS, PostgREST, Supabase Auth, fake mailbox and storage — see `scripts/dev/local-stack.sh`) |
| `npm run test:e2e` | 16 Playwright browser tests at 375px and 1440px against `db:dev` |

- Code and comments are in English; UI texts only in `src/locales/az.json`. To add a language, add
  e.g. `src/locales/ru.json` with the same keys and register it in `src/lib/i18n.ts`.
- Data model and permissions: `docs/data-model.md`. Test evidence and known gaps: `docs/test-report.md`.
- Map data © OpenStreetMap contributors (ODbL) — the attribution in the footer must stay.
