"use server";

import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n";

export type ClaimState = { status: "idle" | "ok" | "error"; message?: string };

// Creates the provider account (first time) and the claim. An admin approves
// it in /admin/iddialar; only then does the provider get edit rights.
export async function submitClaim(_prev: ClaimState, fd: FormData): Promise<ClaimState> {
  const centerId = String(fd.get("centerId") ?? "");
  const organization = String(fd.get("organization") ?? "").trim();
  const phone = String(fd.get("phone") ?? "").trim() || null;
  const message = String(fd.get("message") ?? "").trim().slice(0, 2000) || null;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: "error", message: t("reviews.errorAuth") };

  let { data: provider } = await supabase.from("providers").select("id").eq("profile_id", auth.user.id).maybeSingle();
  if (!provider) {
    if (organization.length < 2 || organization.length > 120) return { status: "error", message: t("claim.errorOrg") };
    const { data, error } = await supabase.from("providers").insert({ profile_id: auth.user.id, organization_name: organization, contact_phone: phone }).select("id").single();
    if (error) {
      console.error("provider create failed", error);
      return { status: "error", message: t("claim.errorFailed") };
    }
    provider = data;
  }

  const { error } = await supabase.from("claims").insert({ center_id: centerId, provider_id: provider.id, message });
  if (error) {
    console.error("claim failed", error);
    if (error.code === "23505") return { status: "error", message: t("claim.alreadyPending") };
    if (error.code === "42501") return { status: "error", message: t("claim.alreadyOwned") };
    return { status: "error", message: t("claim.errorFailed") };
  }
  return { status: "ok", message: t("claim.sent") };
}
