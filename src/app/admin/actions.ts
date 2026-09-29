"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "../../../scripts/seed/lib/importer";

// Admin actions. The database checks the admin role again (RLS and the
// approve_claim / reject_claim functions refuse non-admins).

export async function decideClaim(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const decision = fd.get("decision");
  const supabase = await createClient();
  const { error } = await supabase.rpc(decision === "approve" ? "approve_claim" : "reject_claim", { p_claim_id: id });
  if (error) console.error("decideClaim failed", error);
  revalidatePath("/admin/iddialar");
  revalidatePath("/admin");
}

export async function setHidden(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const hidden = fd.get("hidden") === "true";
  const supabase = await createClient();
  const { data: center, error } = await supabase.from("centers").update({ is_hidden: hidden }).eq("id", id).select("slug").maybeSingle();
  if (error) console.error("setHidden failed", error);
  revalidatePath("/admin/merkezler");
  revalidatePath("/");
  if (center?.slug) revalidatePath(`/merkez/${center.slug}`);
}

export async function createCenter(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  const type = fd.get("type") === "training_center" ? "training_center" : "kindergarten";
  if (!name) return;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("centers")
    .insert({ name, type, slug: slugify(name, crypto.randomUUID()), verification_status: "verified" })
    .select("id")
    .single();
  if (error) {
    console.error("createCenter failed", error);
    return;
  }
  redirect(`/panel/merkez/${data.id}`);
}
