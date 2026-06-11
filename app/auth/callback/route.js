import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = getServiceSupabase();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Redirect back to home after login
  return NextResponse.redirect(`${origin}/`);
}
