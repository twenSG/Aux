import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { guestToken, videoId, title, artist, thumbnail, duration, addedBy, deviceId } = body;

  if (!guestToken || !videoId || !title) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  // Validate video ID — must be exactly 11 alphanumeric chars (YouTube format)
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json({ error: "Invalid video ID." }, { status: 400 });
  }

  // Only accept YouTube's thumbnail CDN
  const safeThumbnail =
    typeof thumbnail === "string" && thumbnail.startsWith("https://i.ytimg.com/")
      ? thumbnail
      : null;

  const supabase = getServiceSupabase();

  const { data: room } = await supabase
    .from("rooms")
    .select("id")
    .eq("guest_token", guestToken)
    .single();

  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  // Rate limit: max 10 queued/playing tracks per device per room
  if (deviceId) {
    const { count } = await supabase
      .from("tracks")
      .select("*", { count: "exact", head: true })
      .eq("room_id", room.id)
      .eq("device_id", deviceId)
      .in("status", ["queued", "playing"]);

    if (count >= 10) {
      return NextResponse.json(
        { error: "You've reached the queue limit. Wait for some songs to play." },
        { status: 429 }
      );
    }
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
    thumbnail: safeThumbnail,
    duration: duration || null,
    added_by: (addedBy || "Someone").toString().slice(0, 40),
    device_id: deviceId || null,
  });

  if (error) {
    return NextResponse.json({ error: "Could not add track." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
