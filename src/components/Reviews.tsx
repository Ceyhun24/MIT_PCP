import Link from "next/link";
import { ReviewForm } from "@/components/ReviewForm";
import { RatingBadge } from "@/components/Badges";
import { getCurrentUser } from "@/lib/auth";
import { getApprovedReviews } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import type { OwnReview } from "@/lib/types";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-500" aria-label={t("reviews.stars", { count: rating })}>
      {"★".repeat(rating)}
      <span className="text-slate-300">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

const statusStyle = { pending: "bg-amber-100 text-amber-800", approved: "bg-emerald-100 text-emerald-800", rejected: "bg-red-100 text-red-800" };

export async function Reviews({ centerId, slug, ratingAvg, ratingCount }: { centerId: string; slug: string; ratingAvg: number | null; ratingCount: number }) {
  const [reviews, user] = await Promise.all([getApprovedReviews(centerId), getCurrentUser()]);

  let own: OwnReview | null = null;
  if (user) {
    const supabase = await createClient();
    const { data } = await supabase.from("reviews").select("id, rating, body, status").eq("center_id", centerId).eq("user_id", user.id).maybeSingle();
    own = data as OwnReview | null;
  }

  return (
    <section aria-labelledby="reviews-h" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="reviews-h" className="text-lg font-semibold">{t("reviews.title")}</h2>
        <RatingBadge avg={ratingAvg} count={ratingCount} />
      </div>

      {reviews.length === 0 ? (
        <p className="text-sm text-slate-500">{t("reviews.none")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {reviews.map((r) => {
            const reply = Array.isArray(r.review_replies) ? r.review_replies[0] : r.review_replies;
            return (
              <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Stars rating={r.rating} />
                  <span className="font-medium">{r.author?.display_name || t("reviews.anonymous")}</span>
                  <span className="text-sm text-slate-500">{formatDate(r.created_at)}</span>
                </div>
                <p className="mt-2 whitespace-pre-line break-words text-slate-800">{r.body}</p>
                {reply && (
                  <div className="mt-3 rounded-lg border-l-4 border-emerald-500 bg-emerald-50 p-3 text-sm">
                    <p className="font-medium text-emerald-900">{t("reviews.providerReply")}</p>
                    <p className="mt-1 whitespace-pre-line break-words text-slate-800">{reply.body}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {own && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{t("reviews.yourReview")}</span>
            <Stars rating={own.rating} />
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[own.status]}`}>{t(`reviews.status_${own.status}`)}</span>
          </div>
        </div>
      )}

      {user ? (
        <ReviewForm centerId={centerId} slug={slug} own={own} displayName={user.displayName} />
      ) : (
        <Link href={`/giris?next=${encodeURIComponent(`/merkez/${slug}`)}`} className="self-start rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700">
          {t("reviews.signInToWrite")}
        </Link>
      )}
    </section>
  );
}
