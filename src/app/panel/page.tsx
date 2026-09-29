import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { TypeBadge, VerificationBadge } from "@/components/Badges";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getMyProvider } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: `${t("panel.title")} — ${t("app.name")}` };

const claimStyle = { pending: "bg-amber-100 text-amber-800", approved: "bg-emerald-100 text-emerald-800", rejected: "bg-red-100 text-red-800" };

export default async function PanelPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/giris?next=${encodeURIComponent("/panel")}`);
  const provider = await getMyProvider(user.id);
  const supabase = await createClient();

  type CenterRow = { id: string; name: string; slug: string; type: "kindergarten" | "training_center"; verification_status: "unverified" | "verified" };
  type ClaimRow = { id: string; status: "pending" | "approved" | "rejected"; created_at: string; centers: { name: string; slug: string } | null };
  let centers: CenterRow[] = [];
  let claims: ClaimRow[] = [];
  if (provider) {
    const [c, cl] = await Promise.all([
      supabase.from("centers").select("id, name, slug, type, verification_status").eq("provider_id", provider.id).order("name"),
      supabase.from("claims").select("id, status, created_at, centers(name, slug)").eq("provider_id", provider.id).order("created_at", { ascending: false }),
    ]);
    centers = (c.data ?? []) as CenterRow[];
    claims = (cl.data ?? []) as unknown as ClaimRow[];
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
        <h1 className="text-2xl font-bold">{t("panel.title")}</h1>
        {centers.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-slate-600">{t("panel.noCenters")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {centers.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-semibold">{c.name}</span>
                  <span className="flex gap-2"><TypeBadge type={c.type} /><VerificationBadge status={c.verification_status} /></span>
                </div>
                <Link href={`/merkez/${c.slug}`} className="text-sm text-emerald-700 hover:underline">{t("panel.view")}</Link>
                <Link href={`/panel/merkez/${c.id}`} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">{t("panel.edit")}</Link>
              </li>
            ))}
          </ul>
        )}
        {claims.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">{t("panel.claims")}</h2>
            <ul className="flex flex-col gap-2">
              {claims.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm">
                  {c.centers && <Link href={`/merkez/${c.centers.slug}`} className="font-medium text-emerald-700 hover:underline">{c.centers.name}</Link>}
                  <span className="text-slate-500">{formatDate(c.created_at)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${claimStyle[c.status]}`}>{t(`panel.claimStatus_${c.status}`)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
