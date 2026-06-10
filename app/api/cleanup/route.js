import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(request) {
  // Verify the request is from Vercel Cron, not a random caller
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  const { error, count } = await supabase
    .from("rooms")
    .delete({ count: "exact" })
    .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ deleted: count });
}
