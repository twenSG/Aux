import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const guestToken = searchParams.get("guestToken");

  if (!guestToken) {
    return NextResponse.json({ error: "Missing guestToken." }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  const { data: room, error } = await supabase
    .from("rooms")
    .select("id, name")
    .eq("guest_token", guestToken)
    .single();

  if (error || !room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  return NextResponse.json({ room });
}
