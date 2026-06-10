import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const guestToken = searchParams.get("guestToken");

  if (!guestToken) {
    return NextResponse.json({ error: "Missing guestToken." }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id")
    .eq("guest_token", guestToken)
    .single();

  if (roomError || !room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  const { data: tracks, error: tracksError } = await supabase
    .from("tracks")
    .select("*")
    .eq("room_id", room.id)
    .neq("status", "played")
    .order("created_at", { ascending: true });

  if (tracksError) {
    return NextResponse.json({ error: tracksError.message }, { status: 500 });
  }

  return NextResponse.json({ tracks: tracks ?? [] });
}
