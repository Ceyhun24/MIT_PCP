import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { moderateReview } from "./actions";

export const metadata: Metadata = { title: `${t("admin.moderation")} — ${t("app.name")}` };

const STATUSES = ["pending", "approved", "rejected"] as const;
type Status = (typeof STATUSES)[number];

type Row = {
  id: string;
  rating: number;
  body: string;
  status: Status;
  created_at: string;
  author: { display_name: string | null } | null;
  centers: { name: string; slug: string } | null;
};

export default async function ModerationPage({ searchParams }: PageProps<"/admin/reyler">) {
  const user = await getCurrentUser();

  const params = await searchParams;
  const status: Status = STATUSES.includes(params.status as Status) ? (params.status as Status) : "pending";

  let rows: Row[] = [];
  if (user?.role === "admin") {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reviews")
      .select("id, rating, body, status, created_at, author:profiles!reviews_user_id_fkey(display_name), centers(name, slug)")
      .eq("status", status)
      .order("created_at", { ascending: status === "pending" })
      .limit(200);
    if (error) console.error("moderation list failed", error);
    rows = (data ?? []) as unknown as Row[];
  }

  return (
    <AdminShell path="/admin/reyler" title={t("admin.moderation")}>
          <>
            <nav className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 sm:self-start">
              {STATUSES.map((s) => (
                <Link
                  key={s}
                  href={s === "pending" ? "/admin/reyler" : `/admin/reyler?status=${s}`}
                  aria-current={s === status ? "page" : undefined}
                  className={`rounded-lg px-3 py-2 text-center text-sm font-medium ${s === status ? "bg-white shadow" : "text-slate-600"}`}
                >
                  {t(`admin.tab_${s}`)}
                </Link>
              ))}
            </nav>
            {rows.length === 0 ? (
              <p className="text-slate-500">{t("admin.empty")}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {rows.map((r) => (
                  <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      {r.centers && (
                        <Link href={`/merkez/${r.centers.slug}`} className="font-semibold text-emerald-700 hover:underline">
                          {r.centers.name}
                        </Link>
                      )}
                      <span className="text-amber-500" aria-label={t("reviews.stars", { count: r.rating })}>
                        {"★".repeat(r.rating)}
                        <span className="text-slate-300">{"★".repeat(5 - r.rating)}</span>
                      </span>
                      <span>{r.author?.display_name || t("reviews.anonymous")}</span>
                      <span className="text-slate-500">{formatDate(r.created_at)}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-line break-words text-slate-800">{r.body}</p>
                    <div className="mt-3 flex gap-2">
                      {r.status !== "approved" && (
                        <form action={moderateReview}>
                          <input type="hidden" name="id" value={r.id} />
                          <button name="decision" value="approved" className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">
                            {t("admin.approve")}
                          </button>
                        </form>
                      )}
                      {r.status !== "rejected" && (
                        <form action={moderateReview}>
                          <input type="hidden" name="id" value={r.id} />
                          <button name="decision" value="rejected" className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">
                            {t("admin.reject")}
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
    </AdminShell>
  );
}
