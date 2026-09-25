# KursTap.az

A directory of kindergartens (bağçalar) and training centers (tədris mərkəzləri) in Baku.
Stack: Next.js + Tailwind, Supabase (Postgres + PostGIS, Auth, Storage), Leaflet + OpenStreetMap.

> Status: **Phase 1** (data model, project setup, seed pipeline). A full plain-language
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

## Docs

- [Data model and permissions](docs/data-model.md)
- [Data sources and collection rules](docs/data-sources.md)
- [How to review the seed CSV](data/seed/README.md)

UI text lives in `src/locales/az.json`. Map data © OpenStreetMap contributors (ODbL).
