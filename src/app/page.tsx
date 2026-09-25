import { t } from "@/lib/i18n";

// Phase 1 placeholder. The real home page (section toggle, search, map) comes in Phase 2.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold sm:text-3xl">{t("app.name")}</h1>
      <p className="text-lg text-slate-600">{t("app.tagline")}</p>
      <div className="flex gap-2">
        <span className="rounded-full bg-emerald-100 px-4 py-2 text-emerald-900">{t("sections.kindergarten")}</span>
        <span className="rounded-full bg-sky-100 px-4 py-2 text-sky-900">{t("sections.training_center")}</span>
      </div>
      <p className="text-slate-500">{t("app.comingSoon")}</p>
      <footer className="mt-auto text-xs text-slate-400">{t("footer.osmAttribution")}</footer>
    </main>
  );
}
