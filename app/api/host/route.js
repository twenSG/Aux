import { NextResponse } from "next/server";
import { getServiceSupabase, makeToken } from "@/lib/supabase";

// All host actions, authenticated by the unguessable host token.
// Actions: play_next | remove | regenerate_guest_token | add_track

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { hostToken, action, trackId, track } = body;

  if (!hostToken || !action) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  const { data: room } = await supabase
    .from("rooms")
    .select("id")
    .eq("host_token", hostToken)
    .single();

  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  if (action === "add_track") {
    if (!track?.videoId || !track?.title) {
      return NextResponse.json({ error: "Missing track fields." }, { status: 400 });
    }

    // Skip duplicates still queued or playing
    const { data: existing } = await supabase
      .from("tracks")
      .select("id")
      .eq("room_id", room.id)
      .eq("video_id", track.videoId)
      .in("status", ["queued", "playing"])
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: "Already in the queue." }, { status: 409 });
    }

    const { error } = await supabase.from("tracks").insert({
      room_id: room.id,
      video_id: track.videoId,
      title: track.title.toString().slice(0, 200),
      artist: (track.artist || "").toString().slice(0, 200),
      thumbnail: track.thumbnail || null,
      duration: track.duration || null,
      added_by: "Host",
      device_id: null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "remove") {
    if (!trackId) {
      return NextResponse.json({ error: "Missing trackId." }, { status: 400 });
    }
    await supabase
      .from("tracks")
      .delete()
      .eq("id", trackId)
      .eq("room_id", room.id);
    return NextResponse.json({ ok: true });
  }

  if (action === "regenerate_guest_token") {
    const guestToken = makeToken();
    const { error } = await supabase
      .from("rooms")
      .update({ guest_token: guestToken })
      .eq("id", room.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, guestToken });
  }

  if (action === "play_next") {
    // Mark whatever is playing as played
    await supabase
      .from("tracks")
      .update({ status: "played" })
      .eq("room_id", room.id)
      .eq("status", "playing");

    // Promote the top queued track: most votes first, then oldest
    const { data: next } = await supabase
      .from("tracks")
      .select("id, video_id, title, artist, thumbnail, duration, added_by, votes")
      .eq("room_id", room.id)
      .eq("status", "queued")
      .order("votes", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1);

    if (!next || next.length === 0) {
      return NextResponse.json({ ok: true, track: null });
    }

    await supabase
      .from("tracks")
      .update({ status: "playing" })
      .eq("id", next[0].id);

    return NextResponse.json({ ok: true, track: next[0] });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
