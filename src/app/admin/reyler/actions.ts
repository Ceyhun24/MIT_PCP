"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Approve or reject a review. Checked twice: here (admin role) and in the
// database (RLS only lets admins change a review's status).
export async function moderateReview(form: FormData) {
  const id = String(form.get("id") ?? "");
  const decision = form.get("decision");
  if (decision !== "approved" && decision !== "rejected") return;
  const user = await getCurrentUser();
  if (user?.role !== "admin") return;

  const supabase = await createClient();
  const { data: review, error } = await supabase.from("reviews").update({ status: decision }).eq("id", id).select("center_id, centers(slug)").maybeSingle();
  if (error) {
    console.error("moderateReview failed", error);
    return;
  }
  revalidatePath("/admin/reyler");
  const slug = (review?.centers as { slug?: string } | null)?.slug;
  if (slug) revalidatePath(`/merkez/${slug}`);
}
