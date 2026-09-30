import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { TypeBadge, VerificationBadge } from "@/components/Badges";
import { inputClass, primaryButton, secondaryButton } from "@/components/panel/FormMessage";
import { t, tDynamic } from "@/lib/i18n";
import { isAdmin } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { createCenter, setHidden } from "../actions";

export const metadata: Metadata = { title: `${t("admin.centers")} — ${t("app.name")}` };

type Row = {
  id: string;
  name: string;
  slug: string;
  type: "kindergarten" | "training_center";
  verification_status: "unverified" | "verified";
  is_hidden: boolean;
  providers: { organization_name: string } | null;
};

export default async function AdminCentersPage({ searchParams }: PageProps<"/admin/merkezler">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  let rows: Row[] = [];
  if (await isAdmin()) {
    const supabase = await createClient();
    let query = supabase.from("centers").select("id, name, slug, type, verification_status, is_hidden, providers(organization_name)").order("name").limit(300);
    if (q) query = query.ilike("name", `%${q.replace(/[%_]/g, "")}%`);
    const { data, error } = await query;
    if (error) console.error("admin centers failed", error);
    rows = (data ?? []) as unknown as Row[];
  }
  return (
    <AdminShell path="/admin/merkezler" title={t("admin.centers")}>
      <div className="grid gap-3 lg:grid-cols-2">
        <form className="flex gap-2" role="search">
          <input name="q" defaultValue={q} placeholder={t("admin.centersSearch")} aria-label={t("admin.centersSearch")} className={inputClass} />
          <button className={secondaryButton}>{t("search.submit")}</button>
        </form>
        <form action={createCenter} className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <input name="name" required placeholder={t("editor.name")} aria-label={t("editor.name")} className={`${inputClass} flex-1`} />
          <select name="type" aria-label={t("editor.type")} className="rounded-lg border border-slate-300 px-2 py-2">
            <option value="kindergarten">{tDynamic("type", "kindergarten")}</option>
            <option value="training_center">{tDynamic("type", "training_center")}</option>
          </select>
          <button className={primaryButton}>{t("admin.newCenter")}</button>
        </form>
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Link href={`/merkez/${c.slug}`} className="font-semibold hover:text-emerald-700 hover:underline">{c.name}</Link>
              <span className="flex flex-wrap items-center gap-2 text-xs">
                <TypeBadge type={c.type} />
                <VerificationBadge status={c.verification_status} />
                {c.is_hidden && <span className="rounded-full bg-slate-200 px-2 py-0.5 font-medium text-slate-700">{t("admin.hiddenBadge")}</span>}
                <span className="text-slate-500">{t("admin.owner")}: {c.providers?.organization_name ?? t("admin.noOwner")}</span>
              </span>
            </div>
            <form action={setHidden}>
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="hidden" value={String(!c.is_hidden)} />
              <button className={secondaryButton}>{c.is_hidden ? t("admin.show") : t("admin.hide")}</button>
            </form>
            <Link href={`/panel/merkez/${c.id}`} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">{t("panel.edit")}</Link>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
