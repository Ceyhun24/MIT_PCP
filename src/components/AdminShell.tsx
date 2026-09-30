import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/auth";
import { t } from "@/lib/i18n";

const LINKS = [
  ["/admin", "admin.title"],
  ["/admin/iddialar", "admin.claims"],
  ["/admin/reyler", "admin.moderation"],
  ["/admin/merkezler", "admin.centers"],
  ["/admin/idxal", "admin.import"],
] as const;

/** Page frame for admin pages: checks the admin role and shows the admin menu. */
export async function AdminShell({ path, title, children }: { path: string; title: string; children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect(`/giris?next=${encodeURIComponent(path)}`);
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6">
        {user.role !== "admin" ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{t("admin.forbidden")}</p>
        ) : (
          <>
            <nav className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 text-sm" aria-label={t("admin.title")}>
              {LINKS.map(([href, key]) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={path === href ? "page" : undefined}
                  className={`shrink-0 rounded-lg px-3 py-2 font-medium ${path === href ? "bg-white shadow" : "text-slate-600 hover:text-slate-900"}`}
                >
                  {t(key)}
                </Link>
              ))}
            </nav>
            <h1 className="text-2xl font-bold">{title}</h1>
            {children}
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
