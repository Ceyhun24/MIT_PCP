"use server";

// Save actions for the listing editor (providers and admins). Every write runs
// with the signed-in person's session: Row Level Security in the database is
// what finally allows or blocks it (a provider can only change own centers).
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n";

export type FormState = { status: "idle" | "ok" | "error"; message?: string };
const ok = (message: string): FormState => ({ status: "ok", message });
const fail = (message: string): FormState => ({ status: "error", message });

const str = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};
/** Empty → null; invalid → NaN (caught by validation). */
const num = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return v === null ? null : Number(v.replace(",", "."));
};
const badNum = (...vals: (number | null)[]) => vals.some((v) => v !== null && (!Number.isFinite(v) || v < 0));
const badRange = (a: number | null, b: number | null) => a !== null && b !== null && a > b;
const isLink = (v: string | null) => {
  if (!v) return true;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return u.hostname.includes(".");
  } catch {
    return false;
  }
};
const withScheme = (v: string | null) => (v ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : null);

async function revalidateCenter(centerId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("centers").select("slug").eq("id", centerId).maybeSingle();
  if (data?.slug) revalidatePath(`/merkez/${data.slug}`);
  revalidatePath(`/panel/merkez/${centerId}`);
  revalidatePath("/");
}

export async function saveCenter(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = String(fd.get("id") ?? "");
  const name = str(fd, "name");
  if (!name) return fail(t("editor.errorName"));

  const ageMin = num(fd, "age_min_years"), ageMax = num(fd, "age_max_years");
  const priceMin = num(fd, "price_min_azn"), priceMax = num(fd, "price_max_azn");
  const groupSize = num(fd, "group_size_max");
  const lat = num(fd, "lat"), lng = num(fd, "lng");
  if (badNum(ageMin, ageMax, priceMin, priceMax, groupSize) || (lat !== null && !Number.isFinite(lat)) || (lng !== null && !Number.isFinite(lng))) {
    return fail(t("editor.errorNumber"));
  }
  if (badRange(ageMin, ageMax) || badRange(priceMin, priceMax)) return fail(t("editor.errorRange"));
  if ((lat === null) !== (lng === null) || (lat !== null && (lat < 39.95 || lat > 40.7 || lng! < 49.3 || lng! > 50.7))) {
    return fail(t("editor.errorLocation"));
  }
  const website = str(fd, "website"), instagram = str(fd, "instagram"), facebook = str(fd, "facebook");
  if (![website, instagram, facebook].every(isLink)) return fail(t("editor.errorLink"));

  const social: Record<string, string> = {};
  if (instagram) social.instagram = withScheme(instagram)!;
  if (facebook) social.facebook = withScheme(facebook)!;
  const districtId = num(fd, "district_id");

  const update: Record<string, unknown> = {
    name,
    description: str(fd, "description"),
    district_id: districtId,
    address: str(fd, "address"),
    location: lat !== null ? `SRID=4326;POINT(${lng} ${lat})` : null,
    phone: str(fd, "phone"),
    email: str(fd, "email"),
    website: withScheme(website),
    social_links: social,
    working_hours: str(fd, "working_hours"),
    age_min_years: ageMin,
    age_max_years: ageMax,
    price_min_azn: priceMin,
    price_max_azn: priceMax,
    group_size_max: groupSize === null ? null : Math.round(groupSize),
    languages: fd.getAll("languages").map(String),
  };

  const supabase = await createClient();
  const { data: admin } = await supabase.rpc("is_admin");
  if (admin === true) {
    update.verification_status = fd.get("verified") === "on" ? "verified" : "unverified";
    update.is_hidden = fd.get("hidden") === "on";
    const type = fd.get("type");
    if (type === "kindergarten" || type === "training_center") update.type = type;
  }

  const { data: saved, error } = await supabase.from("centers").update(update).eq("id", id).select("id");
  if (error) {
    console.error("saveCenter failed", error);
    return fail(error.code === "42501" ? t("editor.errorDenied") : t("editor.errorFailed"));
  }
  // RLS hides rows the person may not change: 0 rows updated = not allowed.
  if (!saved || saved.length === 0) return fail(t("editor.errorDenied"));

  // Amenities: the checkboxes are the full list.
  const slugs = fd.getAll("amenities").map(String);
  const { data: amenities } = await supabase.from("amenities").select("id, slug");
  const { error: delErr } = await supabase.from("center_amenities").delete().eq("center_id", id);
  const rows = (amenities ?? []).filter((a) => slugs.includes(a.slug)).map((a) => ({ center_id: id, amenity_id: a.id }));
  const { error: insErr } = rows.length ? await supabase.from("center_amenities").insert(rows) : { error: null };
  if (delErr || insErr) {
    console.error("amenities save failed", delErr ?? insErr);
    return fail(t("editor.errorFailed"));
  }

  await revalidateCenter(id);
  return ok(t("editor.saved"));
}

export async function saveCourse(_prev: FormState, fd: FormData): Promise<FormState> {
  const centerId = String(fd.get("centerId") ?? "");
  const courseId = str(fd, "courseId");
  const name = str(fd, "name");
  if (!name) return fail(t("courses.errorName"));
  const ageMin = num(fd, "age_min_years"), ageMax = num(fd, "age_max_years"), price = num(fd, "price_azn");
  if (badNum(ageMin, ageMax, price) || badRange(ageMin, ageMax)) return fail(t("courses.errorNumber"));
  const period = str(fd, "price_period");
  const row = {
    name,
    subject: str(fd, "subject"),
    level: str(fd, "level"),
    age_min_years: ageMin,
    age_max_years: ageMax,
    duration: str(fd, "duration"),
    price_azn: price,
    price_period: period === "month" || period === "lesson" || period === "total" ? period : null,
  };
  const supabase = await createClient();
  const { data, error } = courseId
    ? await supabase.from("courses").update(row).eq("id", courseId).eq("center_id", centerId).select("id")
    : await supabase.from("courses").insert({ ...row, center_id: centerId }).select("id");
  if (error || !data?.length) {
    if (error) console.error("saveCourse failed", error);
    return fail(error?.code === "42501" || !data?.length ? t("editor.errorDenied") : t("courses.errorFailed"));
  }
  await revalidateCenter(centerId);
  return ok(t("editor.saved"));
}

export async function deleteCourse(fd: FormData) {
  const centerId = String(fd.get("centerId") ?? "");
  const courseId = String(fd.get("courseId") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.from("courses").delete().eq("id", courseId).eq("center_id", centerId);
  if (error) console.error("deleteCourse failed", error);
  await revalidateCenter(centerId);
}

/** Called after the browser uploaded the file to Storage (which checks ownership too). */
export async function addPhoto(centerId: string, storagePath: string, caption: string): Promise<FormState> {
  if (!storagePath.startsWith(`${centerId}/`)) return fail(t("photos.errorFailed"));
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: last } = await supabase.from("photos").select("sort_order").eq("center_id", centerId).order("sort_order", { ascending: false }).limit(1);
  const { error } = await supabase.from("photos").insert({
    center_id: centerId,
    storage_path: storagePath,
    caption: caption.trim() || null,
    sort_order: (last?.[0]?.sort_order ?? 0) + 1,
    uploaded_by: auth.user?.id ?? null,
  });
  if (error) {
    console.error("addPhoto failed", error);
    await supabase.storage.from("center-photos").remove([storagePath]);
    return fail(t("photos.errorFailed"));
  }
  await revalidateCenter(centerId);
  return ok(t("editor.saved"));
}

export async function deletePhoto(fd: FormData) {
  const photoId = String(fd.get("photoId") ?? "");
  const supabase = await createClient();
  const { data: photo } = await supabase.from("photos").select("center_id, storage_path").eq("id", photoId).maybeSingle();
  if (!photo) return;
  const { data: removed, error } = await supabase.from("photos").delete().eq("id", photoId).select("id");
  if (error || !removed?.length) return;
  await supabase.storage.from("center-photos").remove([photo.storage_path]);
  await revalidateCenter(photo.center_id);
}

export async function saveReply(_prev: FormState, fd: FormData): Promise<FormState> {
  const reviewId = String(fd.get("reviewId") ?? "");
  const centerId = String(fd.get("centerId") ?? "");
  const body = String(fd.get("body") ?? "").trim();
  if (body.length < 2 || body.length > 4000) return fail(t("replies.errorBody"));
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail(t("editor.errorDenied"));
  const { data: provider } = await supabase.from("providers").select("id").eq("profile_id", auth.user.id).maybeSingle();
  if (!provider) return fail(t("editor.errorDenied"));

  const { data: existing } = await supabase.from("review_replies").select("id").eq("review_id", reviewId).maybeSingle();
  const { data, error } = existing
    ? await supabase.from("review_replies").update({ body }).eq("id", existing.id).select("id")
    : await supabase.from("review_replies").insert({ review_id: reviewId, provider_id: provider.id, body }).select("id");
  if (error || !data?.length) {
    if (error) console.error("saveReply failed", error);
    return fail(error?.code === "42501" || !data?.length ? t("editor.errorDenied") : t("replies.errorFailed"));
  }
  await revalidateCenter(centerId);
  return ok(t("replies.saved"));
}
