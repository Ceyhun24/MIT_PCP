# Test report (Phase 5)

Date: 29 September 2026 · Branch: `claude/laughing-wright-ot1iul`

All tests ran on a **local copy of the Supabase setup** (Postgres 16 + PostGIS, PostgREST, Supabase
Auth v2.180, a fake mailbox and a fake photo store that applies the same permission rule) with
**12 fake "TEST" listings** (`supabase/tests/02_dev_fixtures.sql`). No real Supabase project or real
data existed yet (see *Gaps*).

## Results

| Check | Command | Result |
|---|---|---|
| Seed pipeline unit tests (CSV, robots.txt, 2 s rate limit, OSM mapping, website parsing, validation, "never guess") | `npm test` | **11 / 11 passed** |
| Database: permissions, moderation, search, distance | `npm run db:test` | **34 / 34 checks passed** |
| Browser tests, phone 375px + desktop 1440px | `npm run test:e2e` | **16 / 16 passed** (also passed twice in a row on the same database) |
| TypeScript, lint, production build | `npm run typecheck`, `npm run lint`, `npm run build` | **0 errors, 0 warnings, build OK** |

## "Done when" — evidence

**1. Text search, filters and "near me" return correct, distance-sorted results on the seeded data** ✅
- DB: hidden listings excluded; near-me order `1 → 2 → 4`; radius 1 km → 1 result, 3 km → 2; "ingilis" finds a center via its course "İngilis dili"; "GUNES" finds "Günəş"; section + district, price ≤ 220 ₼, age 10 (via course ages), language and amenity filters (`supabase/tests/01_rls_test.sql`).
- Browser: "riyaziyyat" → only the center with that course; price ≤ 400 ₼ + playground → exactly the 2 matching; district Xəzər; age 10; near me (simulated location) → `TEST Bağça 1 (40 m), 6, 2, 3` in distance order; 3 km → 2 results; 1 km → 1 (`tests/e2e/public.spec.ts`).
- *Caveat:* verified on fake seed data only — the real seed CSV could not be collected (see Gaps).

**2. A test user can submit a review; it appears only after admin approval** ✅
- Browser, full real flow: sign in by e-mail link (read from the mailbox) → 4-star review → "Moderasiyada gözləyir" → invisible to a visitor → non-admin cannot open moderation → admin approves → visible with name and stars, average updated (`tests/e2e/reviews.spec.ts`).
- DB: review forced to "pending" even if the user sends "approved"; one review per user per center; cannot review in someone else's name; editing sends it back to moderation; rating recalculated.

**3. A test provider can edit only their own center; attempts to edit another center are blocked by RLS** ✅
- Browser: claim → cannot edit before approval → admin approves → provider edits prices, amenities, hours, adds a course, uploads a photo, replies to a review; all visible on the public page. A save sent with **another center's id** (tampered form) → refused, and the other center is unchanged in the database; opening another center's editor → refused (`tests/e2e/panels.spec.ts`).
- DB: provider update on another center → **0 rows** (RLS); cannot add/delete courses of another center; cannot change admin-only fields (owner, verified, hidden); cannot upload a photo into another center's folder; cannot edit or delete reviews; cannot approve claims.

**4. All pages work at 375px and 1440px, with no untranslated (non-Azerbaijani) UI text** ✅
- Every test runs at both widths and checks there is no sideways scrolling on: home, listing pages, sign-in, 404, review form, provider panel and editor, admin overview, claims, reviews, centers and import.
- Automatic scan for English words (visible text, placeholders, labels, tooltips, page titles) on the same pages, plus a check that no browser-native file picker ("Choose File") is visible. Map zoom buttons and sign-in e-mails are translated too.
- Allowed non-Azerbaijani words: brand names (KursTap.az, OpenStreetMap, Leaflet, Instagram, Facebook), ODbL.

## Gaps and open items

1. **No real data yet.** This environment's network blocks `overpass-api.de`, so the 10 + 10 sample could not be collected. The collector was tested end-to-end against a local fake server. → Allow the host, or run `npm run seed:collect` on your computer.
2. **Real Supabase project set up (30 Sep 2026).** The three migrations and the photo limits were applied; `npm run check:supabase` passes all 7 checks, and the site loads against it (districts from the database, search returns 0 results because no listings are imported yet). Still to do by hand after sign-in is configured: review + approval and provider edit on the real project.
3. **Photo limits**: set on the real bucket (5 MB, JPG/PNG/WEBP).
4. **E-mail sending**: Supabase's built-in e-mail is rate-limited; connect an SMTP service before launch.
5. **Not built (outside the spec)**: spam protection / rate limits on reviews and claims beyond sign-in, e-mail notifications to admins, content-security headers, analytics.
6. **Map tiles**: the free OpenStreetMap tile server suits modest traffic only.
7. **Not deployed** — waiting for your go-ahead.
