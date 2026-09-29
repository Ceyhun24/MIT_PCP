import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { t } from "@/lib/i18n";
import { isAdmin } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: `${t("admin.title")} — ${t("app.name")}` };

export default async function AdminHome() {
  let counts = { claims: 0, reviews: 0, centers: 0 };
  if (await isAdmin()) {
    const supabase = await createClient();
    const [c, r, ce] = await Promise.all([
      supabase.from("claims").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("centers").select("id", { count: "exact", head: true }),
    ]);
    counts = { claims: c.count ?? 0, reviews: r.count ?? 0, centers: ce.count ?? 0 };
  }
  const tiles = [
    { href: "/admin/iddialar", label: t("admin.claims"), value: counts.claims, sub: t("admin.tab_pending") },
    { href: "/admin/reyler", label: t("admin.moderation"), value: counts.reviews, sub: t("admin.tab_pending") },
    { href: "/admin/merkezler", label: t("admin.centers"), value: counts.centers, sub: t("admin.all") },
  ];
  return (
    <AdminShell path="/admin" title={t("admin.title")}>
      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <Link key={tile.href} href={tile.href} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-emerald-400">
            <p className="text-sm text-slate-600">{tile.label}</p>
            <p className="mt-1 text-3xl font-bold">{tile.value}</p>
            <p className="text-xs text-slate-500">{tile.sub}</p>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}
