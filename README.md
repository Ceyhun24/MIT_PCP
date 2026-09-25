# KursTap.az

A directory of kindergartens (bağçalar) and training centers (tədris mərkəzləri) in Baku.
Stack: Next.js + Tailwind, Supabase (Postgres + PostGIS, Auth, Storage), Leaflet + OpenStreetMap.

> Status: **Phase 2** (public site: home, search & filters, near me, list + map, listing pages). A full plain-language
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
| `npm test` | Seed pipeline unit tests |
| `npm run db:test` | Schema + security tests on a local Postgres/PostGIS (`TEST_DATABASE_URL` must be set) |
| `npm run db:dev` | Developer only: local stand-in for Supabase with FAKE "TEST" listings (needs Postgres/PostGIS + PostgREST, see `scripts/dev/local-stack.sh`) |

## Pages

| Address | Page |
|---|---|
| `/` | Home: "Bağçalar / Tədris mərkəzləri" switch, search, filters, "Yaxınlığımda" (near me, 1/3/5/10 km), results as list + map |
| `/merkez/<slug>` | One listing: contacts, hours, ages, prices, languages, amenities, courses, photos, map pin, data source |

Search filters are kept in the address bar, so a search can be bookmarked or shared.

## Docs

- [Data model and permissions](docs/data-model.md)
- [Data sources and collection rules](docs/data-sources.md)
- [How to review the seed CSV](data/seed/README.md)

UI text lives in `src/locales/az.json`. Map data © OpenStreetMap contributors (ODbL).
