"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n";

export type ReviewFormState = { status: "idle" | "ok" | "error"; message?: string };

// Saves the signed-in person's review. The database (RLS + triggers) makes
// sure it is their own and that it starts as "pending" until an admin approves.
export async function submitReview(_prev: ReviewFormState, form: FormData): Promise<ReviewFormState> {
  const centerId = String(form.get("centerId") ?? "");
  const slug = String(form.get("slug") ?? "");
  const rating = Number(form.get("rating"));
  const body = String(form.get("body") ?? "").trim();
  const displayName = String(form.get("displayName") ?? "").trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { status: "error", message: t("reviews.errorRating") };
  if (body.length < 10 || body.length > 4000) return { status: "error", message: t("reviews.errorBody") };
  if (displayName.length < 2 || displayName.length > 60) return { status: "error", message: t("reviews.errorName") };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { status: "error", message: t("reviews.errorAuth") };

  const { error: nameError } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id);
  if (nameError) {
    console.error("profile update failed", nameError);
    return { status: "error", message: t("reviews.errorFailed") };
  }

  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("center_id", centerId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = existing
    ? await supabase.from("reviews").update({ rating, body }).eq("id", existing.id)
    : await supabase.from("reviews").insert({ center_id: centerId, user_id: user.id, rating, body });
  if (error) {
    console.error("review save failed", error);
    return { status: "error", message: t("reviews.errorFailed") };
  }

  revalidatePath(`/merkez/${slug}`);
  return { status: "ok", message: t("reviews.submitted") };
}
