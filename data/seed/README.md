# Seed data (for review before import)

Created by `npm run seed:collect`. **Nothing here is in the database** until you approve
and run `npm run seed:import -- --approved`.

- `centers.csv` — one row per listing. Open in Excel / Google Sheets.
- `courses.csv` — courses, linked to a center by `center_external_id`.
- `skipped_sources.csv` — pages the script was not allowed to read, or could not reach. Fill these in by hand if you want.

Useful columns in `centers.csv`:

| Column | Meaning |
|---|---|
| `type` | `kindergarten` (Bağça) or `training_center` (Tədris mərkəzi) |
| `verification_status` | `unverified` = shown as "Təsdiqlənməyib" on the site |
| `district` | one of: binaqadi, qaradag, xatai, xazar, narimanov, nasimi, nizami, pirallahi, sabuncu, sabail, suraxani, yasamal |
| `price_min_azn`, `price_max_azn` | monthly price in ₼ — empty if not published |
| `languages` | e.g. `az;ru` |
| `amenities` | e.g. `playground;meals;security_cameras` |
| `source_url`, `collected_at` | where and when the row was found |
| `field_sources` | technical: the source of each individual value |

You can correct or fill in cells by hand. After editing, run `npm run seed:check` to find mistakes.
