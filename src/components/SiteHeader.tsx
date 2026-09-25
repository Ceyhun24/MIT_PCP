import Link from "next/link";
import { t } from "@/lib/i18n";

export function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4">
        <Link href="/" className="text-lg font-bold text-emerald-700">
          {t("app.name")}
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-4 text-xs text-slate-500">{t("footer.osmAttribution")}</div>
    </footer>
  );
}
