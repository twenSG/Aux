import { NextResponse } from "next/server";
import YTMusic from "ytmusic-api";

// ytmusic-api scrapes the YouTube Music web client. It needs no API key,
// but being unofficial it can break if YouTube changes their internals —
// this route is the single place to swap in another search backend
// (e.g. the official YouTube Data API) if that ever happens.

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

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  try {
    const yt = await getYTMusic();
    const songs = await yt.searchSongs(q);
    const results = songs.slice(0, 12).map((s) => ({
      videoId: s.videoId,
      title: s.name,
      artist: s.artist?.name || "",
      duration: formatDuration(s.duration),
      thumbnail: s.thumbnails?.[s.thumbnails.length - 1]?.url || null,
    }));
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: "Search is unavailable right now.", detail: String(err) },
      { status: 502 }
    );
  }
}
