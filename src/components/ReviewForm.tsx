"use client";

import { useActionState, useState } from "react";
import { submitReview, type ReviewFormState } from "@/app/merkez/[slug]/actions";
import { t } from "@/lib/i18n";
import type { OwnReview } from "@/lib/types";

type Props = { centerId: string; slug: string; own: OwnReview | null; displayName: string | null };

export function ReviewForm({ centerId, slug, own, displayName }: Props) {
  const [state, action, pending] = useActionState<ReviewFormState, FormData>(submitReview, { status: "idle" });
  const [rating, setRating] = useState(own?.rating ?? 0);

  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-base font-semibold">{own ? t("reviews.edit") : t("reviews.write")}</h3>
      <input type="hidden" name="centerId" value={centerId} />
      <input type="hidden" name="slug" value={slug} />

      <fieldset>
        <legend className="mb-1 text-sm font-medium text-slate-700">{t("reviews.rating")}</legend>
        <div className="flex gap-1" role="radiogroup">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} className="peer sr-only" />
              <span
                aria-hidden
                className={`block text-3xl leading-none peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-emerald-600 ${n <= rating ? "text-amber-500" : "text-slate-300"}`}
              >
                ★
              </span>
              <span className="sr-only">{t("reviews.stars", { count: n })}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">{t("reviews.body")}</span>
        <textarea
          name="body"
          required
          minLength={10}
          maxLength={4000}
          rows={5}
          defaultValue={own?.body}
          placeholder={t("reviews.bodyPlaceholder")}
          className="rounded-lg border border-slate-300 px-3 py-2 text-base"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">{t("reviews.displayName")}</span>
        <input
          name="displayName"
          required
          minLength={2}
          maxLength={60}
          defaultValue={displayName ?? ""}
          placeholder={t("reviews.displayNamePlaceholder")}
          className="rounded-lg border border-slate-300 px-3 py-2 text-base"
        />
        <span className="text-xs text-slate-500">{t("reviews.displayNameHelp")}</span>
      </label>

      {own && <p className="text-xs text-slate-500">{t("reviews.editNote")}</p>}
      {state.status !== "idle" && (
        <p role={state.status === "error" ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${state.status === "ok" ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"}`}>
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className="self-start rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
        {pending ? t("reviews.submitting") : t("reviews.submit")}
      </button>
    </form>
  );
}
