import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { SectionToggle } from "@/components/SectionToggle";
import { SearchForm } from "@/components/SearchForm";
import { ResultsView } from "@/components/ResultsView";
import { getFilterOptions, searchCenters } from "@/lib/data";
import { t } from "@/lib/i18n";
import { PAGE_SIZE, filtersToQuery, parseFilters } from "@/lib/search";

export default async function Home({ searchParams }: PageProps<"/">) {
  const filters = parseFilters(await searchParams);
  const [options, search] = await Promise.all([getFilterOptions(), searchCenters(filters)]);
  const origin: [number, number] | undefined =
    filters.lat !== undefined && filters.lng !== undefined ? [filters.lat, filters.lng] : undefined;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-4 sm:py-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold sm:text-2xl">{t("app.tagline")}</h1>
        </div>
        <SectionToggle filters={filters} />
        <SearchForm filters={filters} districts={options.districts} amenities={options.amenities} />

        {!search.ok ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            {t(search.error === "notConfigured" ? "errors.notConfigured" : "errors.loadFailed")}
          </p>
        ) : (
          <ResultsView
            results={search.data.results}
            origin={origin}
            header={
              <p className="text-sm text-slate-600" aria-live="polite">
                {t("results.count", { count: search.data.total })}
                {origin && ` · ${t("results.sortedByDistance")}`}
              </p>
            }
            footer={
              search.data.results.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-600">{t("results.none")}</p>
              ) : (
                <Pagination page={filters.page} pages={Math.ceil(search.data.total / PAGE_SIZE)} query={(page) => `/${filtersToQuery({ ...filters, page })}`} />
              )
            }
          />
        )}
      </main>
      <SiteFooter />
    </>
  );
}

function Pagination({ page, pages, query }: { page: number; pages: number; query: (page: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav className="flex items-center justify-between gap-2 py-2 text-sm">
      {page > 1 ? (
        <Link href={query(page - 1)} className="rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-50">
          ← {t("results.prev")}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-slate-600">{t("results.page", { page, pages })}</span>
      {page < pages ? (
        <Link href={query(page + 1)} className="rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-50">
          {t("results.next")} →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
