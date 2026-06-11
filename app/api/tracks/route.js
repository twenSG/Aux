import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { guestToken, videoId, title, artist, thumbnail, duration, addedBy, deviceId } = body;

  if (!guestToken || !videoId || !title) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  const { data: room } = await supabase
    .from("rooms")
    .select("id")
    .eq("guest_token", guestToken)
    .single();

  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  // Skip exact duplicates that are still queued or playing
  const { data: existing } = await supabase
    .from("tracks")
    .select("id")
    .eq("room_id", room.id)
    .eq("video_id", videoId)
    .in("status", ["queued", "playing"])
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "Already in the queue." }, { status: 409 });
  }

  const { error } = await supabase.from("tracks").insert({
    room_id: room.id,
    video_id: videoId,
    title: title.toString().slice(0, 200),
    artist: (artist || "").toString().slice(0, 200),
    thumbnail: thumbnail || null,
    duration: duration || null,
    added_by: (addedBy || "Someone").toString().slice(0, 40),
    device_id: deviceId || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
