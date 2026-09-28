// The link in the sign-in e-mail lands here. Exchanges the one-time code for
// a session cookie, then sends the person back to the page they came from.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
    console.error("exchangeCodeForSession failed", error.message);
  }
  return NextResponse.redirect(new URL(`/giris?error=link&next=${encodeURIComponent(next)}`, origin));
}
