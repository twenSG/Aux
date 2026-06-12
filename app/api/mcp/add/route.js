import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import YTMusic from "ytmusic-api";

let ytmusicPromise = null;
function getYTMusic() {
  if (!ytmusicPromise) {
    const yt = new YTMusic();
    ytmusicPromise = yt.initialize().then(() => yt);
  }
  return ytmusicPromise;
}

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "Aux MCP", version: "1.0" });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { guestToken, query } = body;

  if (!guestToken || !query?.trim()) {
    return NextResponse.json({ error: "Missing guestToken or query." }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Verify token
  const { data: room } = await supabase
    .from("rooms")
    .select("id")
    .eq("guest_token", guestToken)
    .single();

  if (!room) {
    return NextResponse.json({ error: "Room not found. Check your guest token." }, { status: 404 });
  }

  // Search YouTube Music
  let track;
  try {
    const yt = await getYTMusic();
    const songs = await yt.searchSongs(query.trim());
    if (!songs || songs.length === 0) {
      return NextResponse.json({ error: `No results found for "${query}".` }, { status: 404 });
    }
    const top = songs[0];
    track = {
      videoId: top.videoId,
      title: top.name,
      artist: top.artist?.name || "",
      duration: formatDuration(top.duration),
      thumbnail: top.thumbnails?.[top.thumbnails.length - 1]?.url || null,
    };
  } catch (err) {
    return NextResponse.json({ error: "Search unavailable right now." }, { status: 502 });
  }

  // Validate video ID
  if (!/^[a-zA-Z0-9_-]{11}$/.test(track.videoId)) {
    return NextResponse.json({ error: "Invalid video ID from search." }, { status: 500 });
  }

  // Sanitise thumbnail
  const safeThumbnail =
    typeof track.thumbnail === "string" && track.thumbnail.startsWith("https://i.ytimg.com/")
      ? track.thumbnail
      : null;

  // Skip duplicates
  const { data: existing } = await supabase
    .from("tracks")
    .select("id")
    .eq("room_id", room.id)
    .eq("video_id", track.videoId)
    .in("status", ["queued", "playing"])
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: `"${track.title}" is already in the queue.` },
      { status: 409 }
    );
  }

  // Insert
  const { error } = await supabase.from("tracks").insert({
    room_id: room.id,
    video_id: track.videoId,
    title: track.title.toString().slice(0, 200),
    artist: track.artist.toString().slice(0, 200),
    thumbnail: safeThumbnail,
    duration: track.duration || null,
    added_by: "Poke",
    device_id: null,
  });

  if (error) {
    return NextResponse.json({ error: "Could not add track." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    added: `${track.title} by ${track.artist}`,
  });
}
