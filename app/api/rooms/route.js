import { NextResponse } from "next/server";
import { getServiceSupabase, makeToken } from "@/lib/supabase";
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

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const name = (body.name || "Jam").toString().slice(0, 60);

  const user = await getUserFromRequest(request);

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("rooms")
    .insert({
      name,
      guest_token: makeToken(),
      host_token: makeToken(),
      user_id: user?.id ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    roomId: data.id,
    name: data.name,
    hostToken: data.host_token,
    guestToken: data.guest_token,
  });
}
