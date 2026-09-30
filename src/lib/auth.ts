// Who is signed in, and what role they have. Server-side only.
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  role: "user" | "provider" | "admin";
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabase.from("profiles").select("display_name, role").eq("id", data.user.id).maybeSingle();
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    displayName: profile?.display_name ?? null,
    role: (profile?.role as CurrentUser["role"]) ?? "user",
  };
}

/** Only allows redirects to pages on this site ("/merkez/x"), never to other sites. */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}
