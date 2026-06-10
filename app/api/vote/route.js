import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { guestToken, trackId } = body;

  if (!guestToken || !trackId) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Confirm the track belongs to the room this token opens
  const { data: track } = await supabase
    .from("tracks")
    .select("id, room_id, rooms!inner(guest_token)")
    .eq("id", trackId)
    .single();

  if (!track || track.rooms.guest_token !== guestToken) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { error } = await supabase.rpc("increment_votes", {
    track_id: trackId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
