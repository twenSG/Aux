import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";

async function getUserFromRequest(request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const { data } = await supabase.auth.getUser(token);
  return data?.user ?? null;
}

export async function GET(request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ room: null }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  // Find the most recent active room for this user
  // Active = created within 24h (matches cron window)
  const { data: room } = await supabase
    .from("rooms")
    .select("id, name, host_token")
    .eq("user_id", user.id)
    .gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({ room: room ?? null });
}
