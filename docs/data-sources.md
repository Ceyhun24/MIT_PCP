# Data sources for the seed pipeline

Rules the pipeline follows: public business information only; robots.txt is checked
before every request; at most 1 request per 2 seconds per website; every value records
where it came from (`source_url`) and when (`collected_at`); a value that is not found is
left empty — never guessed.

## Collected automatically

| Source | What we take | Why it's allowed |
|---|---|---|
| **OpenStreetMap** (Overpass API) | Name, location, address, phone, website, social links, hours, min/max age | Open data under ODbL. Requires the attribution shown in the site footer. |
| **Official website of each center** (only the link listed in OpenStreetMap) | Phone, e-mail, hours, address, Instagram/Facebook link, courses — only from structured data (schema.org) or a single phone link. Prices only when published in AZN as structured data. | The center's own public page; robots.txt respected. |

## Not collected automatically — enter by hand (or ask the center)

These forbid automated collection in their terms, or have no open API:

| Source | Reason |
|---|---|
| Google Maps / Google Business | Terms of service forbid scraping. |
| Instagram, Facebook, TikTok, WhatsApp, Telegram | Terms forbid automated collection. Links are stored, pages are not read. |
| tap.az, boss.az, 2GIS, Yandex Maps | Terms forbid automated collection / no open API. |
| Ministry of Science and Education (edu.gov.az), Baku City Education Office | No machine-readable registry found; check for published lists and enter manually. |
| Any website whose robots.txt disallows us | Listed in `data/seed/skipped_sources.csv` after each run. |
