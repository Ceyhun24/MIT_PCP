// Data for the provider panel and the admin editor. Server-side only; every
// query runs with the signed-in person's session, so RLS decides what they see.
import { createClient } from "@/lib/supabase/server";
import { parseEwkbPoint } from "@/lib/geo";
import type { CenterType } from "@/lib/search";

export type EditableCenter = {
  id: string;
  type: CenterType;
  slug: string;
  name: string;
  description: string | null;
  district_id: number | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  working_hours: string | null;
  age_min_years: number | null;
  age_max_years: number | null;
  price_min_azn: number | null;
  price_max_azn: number | null;
  languages: string[];
  group_size_max: number | null;
  verification_status: "unverified" | "verified";
  is_hidden: boolean;
  provider_id: string | null;
  amenity_slugs: string[];
};

export async function getMyProvider(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("providers").select("id, organization_name, contact_phone").eq("profile_id", userId).maybeSingle();
  return data as { id: string; organization_name: string; contact_phone: string | null } | null;
}

/** Returns the center only if the current person may edit it (owner or admin). */
export async function getEditableCenter(id: string): Promise<EditableCenter | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const [{ data: isAdmin }, { data: isOwner }] = await Promise.all([
    supabase.rpc("is_admin"),
    supabase.rpc("is_center_owner", { p_center_id: id }),
  ]);
  if (!isAdmin && !isOwner) return null;
  const { data } = await supabase
    .from("centers")
    .select(
      `id, type, slug, name, description, district_id, address, location, phone, email, website, social_links, working_hours,
       age_min_years, age_max_years, price_min_azn, price_max_azn, languages, group_size_max, verification_status, is_hidden, provider_id,
       center_amenities(amenities(slug))`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const point = parseEwkbPoint(data.location as string | null);
  const social = (data.social_links ?? {}) as { instagram?: string; facebook?: string };
  return {
    ...(data as unknown as EditableCenter),
    lat: point?.lat ?? null,
    lng: point?.lng ?? null,
    instagram: social.instagram ?? null,
    facebook: social.facebook ?? null,
    amenity_slugs: ((data.center_amenities ?? []) as unknown as { amenities: { slug: string } | null }[])
      .map((ca) => ca.amenities?.slug)
      .filter((s): s is string => Boolean(s)),
  };
}

export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_admin");
  return data === true;
}
