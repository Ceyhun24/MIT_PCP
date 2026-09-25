# Data model (Phase 1)

Schema: `supabase/migrations/20260925000001_init.sql` (tables, search, security) and
`20260925000002_storage.sql` (photo storage).

| Table | What it holds |
|---|---|
| `districts` | The 12 districts (rayonlar) of Baku. Fixed list. |
| `profiles` | One row per signed-in person: display name and role (`user`, `provider`, `admin`). Created automatically at sign-up. |
| `providers` | An organisation account owned by one signed-in person. |
| `centers` | Every listing. `type` is `kindergarten` or `training_center`. Has address, map location (PostGIS), phone, links, hours, ages, price range in AZN per month, languages of instruction, group size, owner, `verification_status` (`unverified` = "Təsdiqlənməyib"), `is_hidden`, and provenance (`source_url`, `collected_at`, and `field_sources` with the source of each field). |
| `courses` | Courses of a training center: name, subject, level, ages, duration, price in AZN (per month / lesson / whole course). |
| `amenities`, `center_amenities` | Environment & infrastructure (playground, cameras, meals, transport…) and which center has which. |
| `photos` | Photo records; the files are in the Storage bucket `center-photos`. |
| `reviews` | 1–5 stars + text. One per person per center. `status` is `pending` until an admin approves. |
| `review_replies` | One reply per review, written by the center's provider. |
| `claims` | A provider's request to take over a listing; an admin approves or rejects. |

## Who can do what (enforced in the database by Row Level Security)

| Action | Visitor | Signed-in user | Provider | Site admin |
|---|---|---|---|---|
| See listings, courses, photos | ✅ (not hidden ones) | ✅ | ✅ + own hidden | ✅ all |
| See reviews | approved only | approved + own | approved | all |
| Write a review | ❌ | ✅ one per center, starts as pending | ✅ | ✅ |
| Approve / reject reviews | ❌ | ❌ | ❌ | ✅ |
| Edit or delete someone's review | ❌ | ❌ | ❌ | ✅ |
| Reply to a review | ❌ | ❌ | ✅ own centers, approved reviews | – |
| Claim a listing | ❌ | ✅ (after creating a provider account) | ✅ | – |
| Approve a claim | ❌ | ❌ | ❌ | ✅ |
| Edit listing details, courses, amenities, photos | ❌ | ❌ | ✅ **own centers only** | ✅ any |
| Change owner, verified status, hidden, rating | ❌ | ❌ | ❌ | ✅ |
| Create / delete listings, change roles | ❌ | ❌ | ❌ | ✅ |

## Search

`search_centers(...)` does text search (name, description, address, course name/subject —
ignores Azerbaijani letters, so "bagca" finds "Bağça"), filters (section, district, price,
age, language, amenities), and "near me" (distance order, optional radius in km).

## Tests

`npm run db:test` runs the migrations on a local Postgres + PostGIS and checks 33 rules
(see `supabase/tests/01_rls_test.sql`).
