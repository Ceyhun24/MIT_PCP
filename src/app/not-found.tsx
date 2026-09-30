import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { t } from "@/lib/i18n";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start gap-4 px-4 py-10">
        <h1 className="text-2xl font-bold">{t("errors.notFound")}</h1>
        <p className="text-slate-600">{t("errors.notFoundText")}</p>
        <Link href="/" className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700">
          {t("nav.home")}
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
