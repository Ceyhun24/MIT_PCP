import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { CenterEditor } from "@/components/panel/CenterEditor";
import { CoursesEditor } from "@/components/panel/CoursesEditor";
import { PhotosEditor } from "@/components/panel/PhotosEditor";
import { ReplyForm } from "@/components/panel/ReplyForm";
import { VerificationBadge } from "@/components/Badges";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getEditableCenter } from "@/lib/panel";
import { createClient } from "@/lib/supabase/server";
import { photoUrl } from "@/lib/supabase/public";
import type { Course } from "@/lib/types";

export const metadata: Metadata = { title: `${t("panel.edit")} — ${t("app.name")}` };

type ReviewRow = { id: string; rating: number; body: string; created_at: string; author: { display_name: string | null } | null; review_replies: { body: string } | { body: string }[] | null };

export default async function EditCenterPage({ params }: PageProps<"/panel/merkez/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/giris?next=${encodeURIComponent(`/panel/merkez/${id}`)}`);
  const center = await getEditableCenter(id);

  if (!center) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-8">
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{t("panel.forbidden")}</p>
          <Link href="/panel" className="text-emerald-700 hover:underline">← {t("panel.title")}</Link>
        </main>
        <SiteFooter />
      </>
    );
  }

  const supabase = await createClient();
  const [districts, amenities, courses, photos, reviews] = await Promise.all([
    supabase.from("districts").select("id, slug, name"),
    supabase.from("amenities").select("slug").order("sort_order"),
    supabase.from("courses").select("id, name, subject, level, age_min_years, age_max_years, duration, price_azn, price_period").eq("center_id", id).order("name"),
    supabase.from("photos").select("id, storage_path, caption, sort_order").eq("center_id", id).order("sort_order"),
    supabase
      .from("reviews")
      .select("id, rating, body, created_at, author:profiles!reviews_user_id_fkey(display_name), review_replies(body)")
      .eq("center_id", id)
      .eq("status", "approved")
      .order("created_at", { ascending: false }),
  ]);
  const districtOptions = ((districts.data ?? []) as { id: number; slug: string; name: string }[]).sort((a, b) => a.name.localeCompare(b.name, "az"));
  const reviewRows = (reviews.data ?? []) as unknown as ReviewRow[];
  const canReply = user.role !== "admin" || center.provider_id !== null;

  const section = (id: string, title: string, children: React.ReactNode) => (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-4 flex flex-col gap-3">
      <h2 id={`${id}-h`} className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-6">
        <div className="flex flex-col gap-2">
          <Link href={user.role === "admin" ? "/admin/merkezler" : "/panel"} className="text-sm text-emerald-700 hover:underline">
            ← {user.role === "admin" ? t("admin.centers") : t("panel.title")}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{center.name}</h1>
            <VerificationBadge status={center.verification_status} />
            {center.is_hidden && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">{t("admin.hiddenBadge")}</span>}
          </div>
          <Link href={`/merkez/${center.slug}`} className="text-sm text-emerald-700 hover:underline">{t("panel.view")} ↗</Link>
          <nav className="flex flex-wrap gap-2 text-sm">
            {[["melumat", "panel.tabDetails"], ["kurslar", "panel.tabCourses"], ["sekiller", "panel.tabPhotos"], ["reyler", "panel.tabReviews"]].map(([anchor, key]) => (
              <a key={anchor} href={`#${anchor}`} className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 hover:bg-slate-200">
                {t(key as "panel.tabDetails")}
              </a>
            ))}
          </nav>
        </div>

        {section("melumat", t("panel.tabDetails"), (
          <CenterEditor center={center} districts={districtOptions} amenities={((amenities.data ?? []) as { slug: string }[]).map((a) => a.slug)} admin={user.role === "admin"} />
        ))}
        {section("kurslar", t("panel.tabCourses"), <CoursesEditor centerId={center.id} courses={(courses.data ?? []) as Course[]} />)}
        {section("sekiller", t("panel.tabPhotos"), (
          <PhotosEditor
            centerId={center.id}
            photos={((photos.data ?? []) as { id: string; storage_path: string; caption: string | null }[]).map((p) => ({ id: p.id, caption: p.caption, url: photoUrl(p.storage_path) }))}
          />
        ))}
        {section("reyler", t("panel.tabReviews"), (
          <>
            <p className="text-sm text-slate-500">{t("replies.note")}</p>
            {reviewRows.length === 0 ? (
              <p className="text-sm text-slate-500">{t("replies.none")}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {reviewRows.map((r) => {
                  const reply = Array.isArray(r.review_replies) ? r.review_replies[0] : r.review_replies;
                  return (
                    <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-center gap-x-3 text-sm">
                        <span className="text-amber-500" aria-label={t("reviews.stars", { count: r.rating })}>{"★".repeat(r.rating)}<span className="text-slate-300">{"★".repeat(5 - r.rating)}</span></span>
                        <span className="font-medium">{r.author?.display_name || t("reviews.anonymous")}</span>
                        <span className="text-slate-500">{formatDate(r.created_at)}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-line break-words">{r.body}</p>
                      {canReply && user.role !== "admin" ? (
                        <ReplyForm reviewId={r.id} centerId={center.id} existing={reply?.body ?? null} />
                      ) : (
                        reply && <p className="mt-2 rounded-lg bg-emerald-50 p-3 text-sm"><span className="font-medium">{t("reviews.providerReply")}:</span> {reply.body}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ))}
      </main>
      <SiteFooter />
    </>
  );
}
