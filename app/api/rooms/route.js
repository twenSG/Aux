import { NextResponse } from "next/server";
import { getServiceSupabase, makeToken } from "@/lib/supabase";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const name = (body.name || "Jam").toString().slice(0, 60);

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("rooms")
    .insert({
      name,
      guest_token: makeToken(),
      host_token: makeToken(),
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
