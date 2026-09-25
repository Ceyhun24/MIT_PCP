"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { t } from "@/lib/i18n";
import type { SearchResult } from "@/lib/types";
import { CenterCard } from "@/components/CenterCard";

const ResultsMap = dynamic(() => import("@/components/ResultsMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-100" />,
});

type Props = { results: SearchResult[]; origin?: [number, number]; header: React.ReactNode; footer: React.ReactNode };

// List and map side by side (desktop) or as two tabs (mobile). Hovering or
// tapping a card highlights its pin; clicking a pin highlights and scrolls to its card.
export function ResultsView({ results, origin, header, footer }: Props) {
  const [selectedId, setSelectedId] = useState<string>();
  const [tab, setTab] = useState<"list" | "map">("list");

  const selectFromMap = useCallback((id: string) => {
    setSelectedId(id);
    document.getElementById(`center-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const selectFromList = useCallback((id: string, showMap = false) => {
    setSelectedId(id);
    if (showMap) setTab("map");
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 lg:hidden" role="tablist">
        {(["list", "map"] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={tab === v}
            onClick={() => setTab(v)}
            className={`rounded-lg py-2 text-sm font-medium ${tab === v ? "bg-white shadow" : "text-slate-600"}`}
          >
            {t(v === "list" ? "results.list" : "results.map")}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className={`${tab === "list" ? "flex" : "hidden"} flex-col gap-3 lg:flex`} aria-label={t("results.list")}>
          {header}
          {results.map((r) => (
            <CenterCard
              key={r.id}
              center={r}
              selected={r.id === selectedId}
              onHover={() => selectFromList(r.id)}
              onShowOnMap={() => selectFromList(r.id, true)}
            />
          ))}
          {footer}
        </section>

        <section
          className={`${tab === "map" ? "block" : "hidden"} h-[60vh] min-h-80 overflow-hidden rounded-xl border border-slate-200 lg:sticky lg:top-4 lg:block lg:h-[75vh]`}
          aria-label={t("results.map")}
        >
          <ResultsMap results={results} selectedId={selectedId} onSelect={selectFromMap} origin={origin} />
        </section>
      </div>
    </div>
  );
}
