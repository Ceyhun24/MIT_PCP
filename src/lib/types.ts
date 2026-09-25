import type { CenterType } from "@/lib/search";

export type SearchResult = {
  id: string;
  type: CenterType;
  slug: string;
  name: string;
  district_name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  price_min_azn: number | null;
  price_max_azn: number | null;
  age_min_years: number | null;
  age_max_years: number | null;
  languages: string[];
  rating_avg: number | null;
  rating_count: number;
  verification_status: "unverified" | "verified";
  distance_m: number | null;
  total_count: number;
};

export type Course = {
  id: string;
  name: string;
  subject: string | null;
  level: string | null;
  age_min_years: number | null;
  age_max_years: number | null;
  duration: string | null;
  price_azn: number | null;
  price_period: "month" | "lesson" | "total" | null;
};

export type CenterDetail = {
  id: string;
  type: CenterType;
  slug: string;
  name: string;
  description: string | null;
  address: string | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  social_links: { instagram?: string; facebook?: string } | null;
  working_hours: string | null;
  age_min_years: number | null;
  age_max_years: number | null;
  price_min_azn: number | null;
  price_max_azn: number | null;
  languages: string[];
  group_size_max: number | null;
  verification_status: "unverified" | "verified";
  rating_avg: number | null;
  rating_count: number;
  source_url: string | null;
  collected_at: string | null;
  district: { slug: string; name: string } | null;
  courses: Course[];
  center_amenities: { amenities: { slug: string; sort_order: number } | null }[];
  photos: { id: string; storage_path: string; caption: string | null; sort_order: number }[];
};

export type Option = { slug: string; name: string };
