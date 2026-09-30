import Link from "next/link";
import { t, tDynamic } from "@/lib/i18n";
import { formatAgeRange, formatDistance, formatPriceRange } from "@/lib/format";
import type { SearchResult } from "@/lib/types";
import { RatingBadge, VerificationBadge } from "@/components/Badges";

type Props = {
  center: SearchResult;
  selected?: boolean;
  onHover?: () => void;
  onShowOnMap?: () => void;
};

export function CenterCard({ center, selected, onHover, onShowOnMap }: Props) {
  const price = formatPriceRange(center.price_min_azn, center.price_max_azn);
  const ages = formatAgeRange(center.age_min_years, center.age_max_years);
  const distance = formatDistance(center.distance_m);
  return (
    <article
      id={`center-${center.id}`}
      onMouseEnter={onHover}
      onFocus={onHover}
      className={`rounded-xl border bg-white p-4 transition ${selected ? "border-emerald-500 ring-2 ring-emerald-200" : "border-slate-200"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold leading-snug">
          <Link href={`/merkez/${center.slug}`} className="hover:text-emerald-700 hover:underline">
            {center.name}
          </Link>
        </h3>
        {distance && <span className="shrink-0 text-sm text-slate-500">{t("units.away", { distance })}</span>}
      </div>
      <p className="mt-1 text-sm text-slate-600">
        {[center.district_name, center.address].filter(Boolean).join(" · ") || t("center.notProvided")}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {price && (
          <span className="font-medium text-slate-900">
            {price} <span className="font-normal text-slate-500">/ {t("center.perMonth")}</span>
          </span>
        )}
        {ages && <span className="text-slate-600">{ages}</span>}
        {center.languages.length > 0 && (
          <span className="text-slate-600">{center.languages.map((l) => tDynamic("languages", l)).join(", ")}</span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <VerificationBadge status={center.verification_status} />
        <RatingBadge avg={center.rating_avg} count={center.rating_count} />
        {onShowOnMap && center.lat !== null && (
          <button type="button" onClick={onShowOnMap} className="ml-auto text-sm text-emerald-700 hover:underline lg:hidden" aria-label={`${t("results.map")}: ${center.name}`}>
            {t("results.map")}
          </button>
        )}
      </div>
    </article>
  );
}
