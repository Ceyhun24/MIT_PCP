import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { formatDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { isAdmin } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { decideClaim } from "../actions";

export const metadata: Metadata = { title: `${t("admin.claims")} — ${t("app.name")}` };

type ClaimRow = {
  id: string;
  message: string | null;
  created_at: string;
  centers: { name: string; slug: string } | null;
  providers: { organization_name: string; contact_phone: string | null } | null;
};

export default async function ClaimsPage() {
  let rows: ClaimRow[] = [];
  if (await isAdmin()) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("claims")
      .select("id, message, created_at, centers(name, slug), providers(organization_name, contact_phone)")
      .eq("status", "pending")
      .order("created_at");
    if (error) console.error("claims list failed", error);
    rows = (data ?? []) as unknown as ClaimRow[];
  }
  return (
    <AdminShell path="/admin/iddialar" title={t("admin.claims")}>
      {rows.length === 0 ? (
        <p className="text-slate-500">{t("admin.claimsEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((c) => (
            <li key={c.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {c.centers && <Link href={`/merkez/${c.centers.slug}`} className="font-semibold text-emerald-700 hover:underline">{c.centers.name}</Link>}
                <span className="text-sm text-slate-500">{formatDate(c.created_at)}</span>
              </div>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-slate-500">{t("admin.claimFrom")}</dt>
                <dd>{c.providers?.organization_name}</dd>
                {c.providers?.contact_phone && (<><dt className="text-slate-500">{t("admin.claimPhone")}</dt><dd><a href={`tel:${c.providers.contact_phone}`} className="text-emerald-700">{c.providers.contact_phone}</a></dd></>)}
                {c.message && (<><dt className="text-slate-500">{t("admin.claimMessage")}</dt><dd className="whitespace-pre-line break-words">{c.message}</dd></>)}
              </dl>
              <form action={decideClaim} className="mt-3 flex gap-2">
                <input type="hidden" name="id" value={c.id} />
                <button name="decision" value="approve" className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">{t("admin.approve")}</button>
                <button name="decision" value="reject" className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">{t("admin.reject")}</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
