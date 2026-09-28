# KursTap.az

A directory of kindergartens (bağçalar) and training centers (tədris mərkəzləri) in Baku.
Stack: Next.js + Tailwind, Supabase (Postgres + PostGIS, Auth, Storage), Leaflet + OpenStreetMap.

> Status: **Phase 3** (sign-in by e-mail link, reviews, review moderation). A full plain-language
> guide to running and deploying comes in Phase 5.

## Quick start (developer)

Needs Node.js 22.22+ (or 24+).

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

## Commands

| Command | What it does |
|---|---|
| `npm run seed:collect` | Collects 10 kindergartens + 10 training centers into `data/seed/*.csv` (add `-- --limit 50` for more) |
| `npm run seed:check` | Checks the CSV files for mistakes |
| `npm run seed:import` | Dry run: shows what would be imported |
| `npm run seed:import -- --approved` | Imports the approved CSV files into Supabase |
| `npm run make-admin -- you@example.com` | Makes an account a site admin (sign in on the site once first) |
| `npm test` | Seed pipeline unit tests |
| `npm run test:e2e` | Browser tests at 375px and 1440px (needs `npm run db:dev` running; see `playwright.config.ts`) |
| `npm run db:test` | Schema + security tests on a local Postgres/PostGIS (`TEST_DATABASE_URL` must be set) |
| `npm run db:dev` | Developer only: local stand-in for Supabase with FAKE "TEST" listings (needs Postgres/PostGIS + PostgREST, see `scripts/dev/local-stack.sh`) |

## Pages

| Address | Page |
|---|---|
| `/` | Home: "Bağçalar / Tədris mərkəzləri" switch, search, filters, "Yaxınlığımda" (near me, 1/3/5/10 km), results as list + map |
| `/merkez/<slug>` | One listing: contacts, hours, ages, prices, languages, amenities, courses, photos, map pin, data source, reviews |
| `/giris` | Sign in with an e-mail link (no password) |
| `/admin/reyler` | Site admins: approve or reject reviews |

Search filters are kept in the address bar, so a search can be bookmarked or shared.

## Sign-in setup in Supabase (once)

1. **Authentication → URL Configuration**: set *Site URL* to your site address (e.g. `https://kurstap.az`) and add `https://kurstap.az/auth/callback` (and `http://localhost:3000/auth/callback` for testing) to *Redirect URLs*.
2. **Authentication → Emails**: paste the Azerbaijani templates from `supabase/email-templates/`.
3. Sign in on the site with your e-mail, then run `npm run make-admin -- your@email` to become a site admin.

Reviews: signed-in people write one review (1–5 ★ + text) per center; it is shown only after an admin
approves it at `/admin/reyler`. Editing a review sends it back for approval.

## Docs

- [Data model and permissions](docs/data-model.md)
- [Data sources and collection rules](docs/data-sources.md)
- [How to review the seed CSV](data/seed/README.md)

UI text lives in `src/locales/az.json`. Map data © OpenStreetMap contributors (ODbL).
