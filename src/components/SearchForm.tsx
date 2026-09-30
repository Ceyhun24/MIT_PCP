"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { t, tDynamic } from "@/lib/i18n";
import { DEFAULT_RADIUS, RADIUS_OPTIONS, filtersToQuery, type Filters } from "@/lib/search";
import type { Option } from "@/lib/types";

const LANGUAGE_OPTIONS = ["az", "ru", "en", "tr"];

type Props = { filters: Filters; districts: Option[]; amenities: string[] };

const toNumber = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? undefined : Number(v));

export function SearchForm({ filters, districts, amenities }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const activeCount =
    [filters.district, filters.priceMin, filters.priceMax, filters.age, filters.lang].filter((v) => v !== undefined).length +
    filters.amenities.length;
  const [open, setOpen] = useState(false);
  const [geoState, setGeoState] = useState<"idle" | "locating" | "denied" | "unsupported">("idle");
  const nearMe = filters.lat !== undefined && filters.lng !== undefined;

  const go = (next: Partial<Filters>) => {
    const merged: Filters = { ...filters, ...next, page: 1 };
    startTransition(() => router.push(`/${filtersToQuery(merged)}`, { scroll: false }));
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const str = (k: string) => (form.get(k) as string | null)?.trim() || undefined;
    go({
      q: str("q"),
      district: str("district"),
      priceMin: toNumber((form.get("pmin") as string) ?? ""),
      priceMax: toNumber((form.get("pmax") as string) ?? ""),
      age: toNumber((form.get("age") as string) ?? ""),
      lang: str("lang"),
      amenities: form.getAll("amen") as string[],
    });
    setOpen(false);
  };

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setGeoState("unsupported");
      return;
    }
    setGeoState("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoState("idle");
        go({ lat: pos.coords.latitude, lng: pos.coords.longitude, radius: filters.radius ?? DEFAULT_RADIUS });
      },
      () => setGeoState("denied"),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  };

  // Remount the form when the URL changes so inputs show the current filters.
  const formKey = filtersToQuery(filters);

  return (
    <div className="flex flex-col gap-3">
      <form key={formKey} onSubmit={onSubmit} className="flex flex-col gap-3" role="search">
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="q">
            {t("search.placeholder")}
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder={t("search.placeholder")}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            disabled={pending}
          >
            {t("search.submit")}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="filters-panel"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {t("search.filters")}
            {activeCount > 0 && (
              <span className="ml-1.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-xs text-white">{activeCount}</span>
            )}
          </button>

          {nearMe ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm text-emerald-900">
              <span>📍 {t("search.nearMeOn")}</span>
              <label className="flex items-center gap-1">
                <span className="sr-only">{t("search.radius")}</span>
                <select
                  aria-label={t("search.radius")}
                  value={filters.radius ?? DEFAULT_RADIUS}
                  onChange={(e) => go({ radius: Number(e.target.value) })}
                  className="rounded border border-emerald-300 bg-white px-1.5 py-1"
                >
                  {RADIUS_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {t("units.km", { value: r })}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={() => go({ lat: undefined, lng: undefined, radius: undefined })} className="underline">
                {t("search.nearMeOff")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={locate}
              disabled={geoState === "locating"}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              📍 {geoState === "locating" ? t("search.locating") : t("search.nearMe")}
            </button>
          )}
        </div>
        {(geoState === "denied" || geoState === "unsupported") && (
          <p role="alert" className="text-sm text-red-700">
            {geoState === "denied" ? t("search.geoDenied") : t("search.geoUnsupported")}
          </p>
        )}

        <fieldset id="filters-panel" hidden={!open} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
          <legend className="sr-only">{t("search.filters")}</legend>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">{t("search.district")}</span>
            <select name="district" defaultValue={filters.district ?? ""} className="rounded-lg border border-slate-300 px-2 py-2">
              <option value="">{t("search.anyDistrict")}</option>
              {districts.map((d) => (
                <option key={d.slug} value={d.slug}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">{t("search.price")}</span>
            <div className="flex items-center gap-2">
              <input name="pmin" type="number" min={0} inputMode="numeric" defaultValue={filters.priceMin} placeholder={t("search.priceMin")} aria-label={`${t("search.price")} — ${t("search.priceMin")}`} className="w-full min-w-0 rounded-lg border border-slate-300 px-2 py-2" />
              <span aria-hidden>–</span>
              <input name="pmax" type="number" min={0} inputMode="numeric" defaultValue={filters.priceMax} placeholder={t("search.priceMax")} aria-label={`${t("search.price")} — ${t("search.priceMax")}`} className="w-full min-w-0 rounded-lg border border-slate-300 px-2 py-2" />
            </div>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">{t("search.age")}</span>
            <input name="age" type="number" min={0} max={99} step="0.5" inputMode="decimal" defaultValue={filters.age} placeholder={t("search.agePlaceholder")} className="rounded-lg border border-slate-300 px-2 py-2" />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">{t("search.language")}</span>
            <select name="lang" defaultValue={filters.lang ?? ""} className="rounded-lg border border-slate-300 px-2 py-2">
              <option value="">{t("search.anyLanguage")}</option>
              {LANGUAGE_OPTIONS.map((code) => (
                <option key={code} value={code}>
                  {tDynamic("languages", code)}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-2 text-sm sm:col-span-2 lg:col-span-4">
            <span className="font-medium text-slate-700">{t("search.amenities")}</span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {amenities.map((slug) => (
                <label key={slug} className="flex items-center gap-2">
                  <input type="checkbox" name="amen" value={slug} defaultChecked={filters.amenities.includes(slug)} className="h-4 w-4 accent-emerald-600" />
                  {tDynamic("amenities", slug)}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
            <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700">
              {t("search.apply")}
            </button>
            <button
              type="button"
              onClick={() => {
                go({ district: undefined, priceMin: undefined, priceMax: undefined, age: undefined, lang: undefined, amenities: [] });
                setOpen(false);
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
            >
              {t("search.reset")}
            </button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
