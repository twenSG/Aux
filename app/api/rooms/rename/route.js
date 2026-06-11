import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { hostToken, name } = body;

  if (!hostToken || !name?.trim()) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  const { error } = await supabase
    .from("rooms")
    .update({ name: name.trim().slice(0, 60) })
    .eq("host_token", hostToken);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
