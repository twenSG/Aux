import { NextResponse } from "next/server";
import { google } from "googleapis";

// Initialize the YouTube Data API client
const youtube = google.youtube({
  version: "v3",
  auth: process.env.YOUTUBE_API_KEY,
});

function formatDuration(isoDuration) {
  // YouTube Data API returns duration in ISO 8601 format (e.g., PT1M30S)
  const match = isoDuration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return null;
  
  const hours = (parseInt(match[1]) || 0);
  const minutes = (parseInt(match[2]) || 0) + (hours * 60);
  const seconds = (parseInt(match[3]) || 0);
  
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  
  if (q.length < 2) return NextResponse.json({ results: [] });

  try {
    // 1. Search for videos
    const searchResponse = await youtube.search.list({
      q: q,
      part: "snippet",
      maxResults: 12,
      type: "video",
      videoCategoryId: "10", // Category 10 is 'Music'
    });

    const videoIds = searchResponse.data.items.map((item) => item.id.videoId).join(",");

    // 2. Fetch details (including contentDetails for duration)
    const detailsResponse = await youtube.videos.list({
      part: "snippet,contentDetails",
      id: videoIds,
    });

    // 3. Format results to match your expected frontend structure
    const results = detailsResponse.data.items.map((s) => ({
      videoId: s.id,
      title: s.snippet.title,
      artist: s.snippet.channelTitle, // Official API doesn't separate artist/title clearly
      duration: formatDuration(s.contentDetails.duration),
      thumbnail: s.snippet.thumbnails?.high?.url || null,
    }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error("YouTube API Error:", err);
    return NextResponse.json(
      { error: "Search is unavailable right now.", detail: String(err) },
      { status: 502 }
    );
  }
}
