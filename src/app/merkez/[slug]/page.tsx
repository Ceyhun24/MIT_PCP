import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { RatingBadge, TypeBadge, VerificationBadge } from "@/components/Badges";
import { PinMapLazy } from "@/components/PinMapLazy";
import { getCenter } from "@/lib/data";
import { formatAgeRange, formatAzn, formatDate, formatPriceRange } from "@/lib/format";
import { t, tDynamic } from "@/lib/i18n";
import { photoUrl } from "@/lib/supabase/public";
import type { CenterDetail } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/merkez/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const res = await getCenter(slug);
  const name = res.ok && res.data ? res.data.name : t("errors.notFound");
  return { title: `${name} — ${t("app.name")}` };
}

const withScheme = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);
const displayUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");

export default async function CenterPage({ params }: PageProps<"/merkez/[slug]">) {
  const { slug } = await params;
  const res = await getCenter(slug);
  if (res.ok && !res.data) notFound();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-4 sm:py-6">
        <Link href="/" className="text-sm text-emerald-700 hover:underline">
          ← {t("nav.back")}
        </Link>
        {!res.ok ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            {t(res.error === "notConfigured" ? "errors.notConfigured" : "errors.loadFailed")}
          </p>
        ) : (
          <CenterDetails center={res.data!} />
        )}
      </main>
      <SiteFooter />
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 border-b border-slate-100 py-2.5 last:border-0 sm:grid-cols-[12rem_1fr] sm:gap-4">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="break-words text-slate-900">{children ?? <span className="text-slate-400">{t("center.notProvided")}</span>}</dd>
    </div>
  );
}

function CenterDetails({ center }: { center: CenterDetail }) {
  const price = formatPriceRange(center.price_min_azn, center.price_max_azn);
  const amenities = center.center_amenities
    .map((ca) => ca.amenities)
    .filter((a): a is { slug: string; sort_order: number } => Boolean(a))
    .sort((a, b) => a.sort_order - b.sort_order);
  const social = center.social_links ?? {};

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={center.type} />
          <VerificationBadge status={center.verification_status} />
        </div>
        <h1 className="text-2xl font-bold sm:text-3xl">{center.name}</h1>
        <div className="flex flex-wrap items-center gap-3 text-slate-600">
          {center.district && <span>{center.district.name}</span>}
          {center.rating_count > 0 ? (
            <RatingBadge avg={center.rating_avg} count={center.rating_count} />
          ) : (
            <span className="text-sm text-slate-400">{t("center.noRatings")}</span>
          )}
        </div>
        {center.description && <p className="max-w-prose text-slate-700">{center.description}</p>}
        {center.verification_status === "unverified" && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{t("center.unverifiedNote")}</p>
        )}
      </header>

      {center.photos.length > 0 && (
        <section aria-labelledby="photos-h">
          <h2 id="photos-h" className="mb-2 text-lg font-semibold">{t("center.photos")}</h2>
          <div className="flex snap-x gap-3 overflow-x-auto pb-2">
            {center.photos.map((p) => (
              // Plain <img>: photos come from Supabase Storage, no image optimiser needed for the MVP.
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={photoUrl(p.storage_path)} alt={p.caption ?? center.name} loading="lazy" className="h-48 w-72 shrink-0 snap-start rounded-xl object-cover" />
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-xl border border-slate-200 bg-white px-4">
          <dl>
            <Row label={t("center.address")}>{center.address}</Row>
            <Row label={t("center.phone")}>
              {center.phone ? (
                <a href={`tel:${center.phone.replace(/[^\d+]/g, "")}`} className="text-emerald-700 hover:underline">
                  {center.phone}
                </a>
              ) : null}
            </Row>
            {center.email && (
              <Row label={t("center.email")}>
                <a href={`mailto:${center.email}`} className="text-emerald-700 hover:underline">{center.email}</a>
              </Row>
            )}
            <Row label={t("center.website")}>
              {center.website ? (
                <a href={withScheme(center.website)} target="_blank" rel="noopener noreferrer nofollow" className="text-emerald-700 hover:underline">
                  {displayUrl(center.website)}
                </a>
              ) : null}
            </Row>
            {(social.instagram || social.facebook) && (
              <Row label={t("center.social")}>
                <span className="flex flex-wrap gap-3">
                  {social.instagram && (
                    <a href={withScheme(social.instagram)} target="_blank" rel="noopener noreferrer nofollow" className="text-emerald-700 hover:underline">{t("center.instagram")}</a>
                  )}
                  {social.facebook && (
                    <a href={withScheme(social.facebook)} target="_blank" rel="noopener noreferrer nofollow" className="text-emerald-700 hover:underline">{t("center.facebook")}</a>
                  )}
                </span>
              </Row>
            )}
            <Row label={t("center.hours")}>{center.working_hours}</Row>
            <Row label={t("center.ages")}>{formatAgeRange(center.age_min_years, center.age_max_years)}</Row>
            <Row label={t("center.price")}>{price ? `${price} / ${t("center.perMonth")}` : null}</Row>
            <Row label={t("center.languages")}>
              {center.languages.length ? center.languages.map((l) => tDynamic("languages", l)).join(", ") : null}
            </Row>
            {center.group_size_max !== null && (
              <Row label={t("center.groupSize")}>{t("center.groupSizeValue", { count: center.group_size_max })}</Row>
            )}
          </dl>
        </section>

        <aside className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t("center.location")}</h2>
          {center.lat !== null && center.lng !== null ? (
            <>
              <div className="h-64 overflow-hidden rounded-xl border border-slate-200">
                <PinMapLazy lat={center.lat} lng={center.lng!} label={center.name} />
              </div>
              <a
                href={`https://www.openstreetmap.org/?mlat=${center.lat}&mlon=${center.lng}#map=17/${center.lat}/${center.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-emerald-700 hover:underline"
              >
                {t("center.openMap")} ↗
              </a>
            </>
          ) : (
            <p className="text-sm text-slate-400">{t("center.notProvided")}</p>
          )}
        </aside>
      </div>

      <section aria-labelledby="amenities-h">
        <h2 id="amenities-h" className="mb-2 text-lg font-semibold">{t("center.amenities")}</h2>
        {amenities.length ? (
          <ul className="flex flex-wrap gap-2">
            {amenities.map((a) => (
              <li key={a.slug} className="rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-800">✓ {tDynamic("amenities", a.slug)}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">{t("center.notProvided")}</p>
        )}
      </section>

      {(center.type === "training_center" || center.courses.length > 0) && (
        <section aria-labelledby="courses-h">
          <h2 id="courses-h" className="mb-2 text-lg font-semibold">{t("center.courses")}</h2>
          {center.courses.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {center.courses.map((c) => (
                <li key={c.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="font-semibold">{c.name}</h3>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                    {c.subject && (<><dt className="text-slate-500">{t("course.subject")}</dt><dd>{c.subject}</dd></>)}
                    {(c.level || c.age_min_years !== null || c.age_max_years !== null) && (
                      <>
                        <dt className="text-slate-500">{t("course.level")}</dt>
                        <dd>{[formatAgeRange(c.age_min_years, c.age_max_years), c.level].filter(Boolean).join(" · ")}</dd>
                      </>
                    )}
                    {c.duration && (<><dt className="text-slate-500">{t("course.duration")}</dt><dd>{c.duration}</dd></>)}
                    <dt className="text-slate-500">{t("course.price")}</dt>
                    <dd className="font-medium">
                      {c.price_azn !== null
                        ? `${formatAzn(Number(c.price_azn))}${c.price_period ? ` / ${tDynamic("pricePeriod", c.price_period)}` : ""}`
                        : <span className="font-normal text-slate-400">{t("center.notProvided")}</span>}
                    </dd>
                  </dl>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">{t("center.notProvided")}</p>
          )}
        </section>
      )}

      {center.source_url && (
        <p className="text-xs text-slate-500">
          {t("center.source")}:{" "}
          <a href={center.source_url} target="_blank" rel="noopener noreferrer nofollow" className="underline">
            {displayUrl(center.source_url)}
          </a>
          {center.collected_at && ` · ${t("center.collectedAt", { date: formatDate(center.collected_at) })}`}
        </p>
      )}
    </article>
  );
}
