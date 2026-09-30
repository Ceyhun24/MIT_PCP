import Link from "next/link";
import { signOut } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";
import { t } from "@/lib/i18n";

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
        <Link href="/" className="text-lg font-bold text-emerald-700">
          {t("app.name")}
        </Link>
        <nav className="ml-auto flex items-center gap-3 text-sm">
          {user && (
            <Link href="/panel" className="font-medium text-slate-700 hover:text-emerald-700">
              {t("nav.panel")}
            </Link>
          )}
          {user?.role === "admin" && (
            <Link href="/admin" className="font-medium text-slate-700 hover:text-emerald-700">
              {t("nav.admin")}
            </Link>
          )}
          {user ? (
            <form action={signOut}>
              <button type="submit" className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50" title={t("auth.signedInAs", { name: user.displayName ?? user.email ?? "" })}>
                {t("auth.signOut")}
              </button>
            </form>
          ) : (
            <Link href="/giris" className="rounded-lg bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700">
              {t("auth.signIn")}
            </Link>
          )}
        </nav>
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
