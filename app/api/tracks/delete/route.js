import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { guestToken, trackId, deviceId } = body;

  if (!guestToken || !trackId || !deviceId) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Verify the track belongs to this room and this device
  const { data: track } = await supabase
    .from("tracks")
    .select("id, device_id, status, rooms!inner(guest_token)")
    .eq("id", trackId)
    .single();

  if (!track || track.rooms.guest_token !== guestToken) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (track.device_id !== deviceId) {
    return NextResponse.json({ error: "You can only remove songs you added." }, { status: 403 });
  }

  if (track.status === "playing") {
    return NextResponse.json({ error: "Can't remove a track that's currently playing." }, { status: 409 });
  }

  const { error } = await supabase
    .from("tracks")
    .delete()
    .eq("id", trackId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
