import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import YTMusic from "ytmusic-api";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

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

async function sendMessage(chatId, text) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

async function handleStart(chatId, args, supabase) {
  const token = args.trim();
  if (!token) {
    return sendMessage(chatId, "Usage: /start <guest_token>\n\nAsk the host for the link and copy the token from the URL.");
  }

  // Verify token is valid
  const { data: room } = await supabase
    .from("rooms")
    .select("id, name")
    .eq("guest_token", token)
    .single();

  if (!room) {
    return sendMessage(chatId, "❌ That token doesn't match any active jam. Ask the host for a fresh link.");
  }

  // Save or update chat registration
  await supabase
    .from("telegram_chats")
    .upsert({ chat_id: chatId, guest_token: token }, { onConflict: "chat_id" });

  return sendMessage(chatId, `✅ Connected to <b>${room.name}</b>!\n\nUse /add &lt;song name&gt; to add songs to the queue.`);
}

async function handleAdd(chatId, query, supabase) {
  if (!query.trim()) {
    return sendMessage(chatId, "Usage: /add &lt;song name&gt;\nExample: /add Blinding Lights");
  }

  // Get registered token for this chat
  const { data: chat } = await supabase
    .from("telegram_chats")
    .select("guest_token")
    .eq("chat_id", chatId)
    .single();

  if (!chat) {
    return sendMessage(chatId, "No jam active. Ask the host for the link and use /start &lt;token&gt; to connect.");
  }

  // Verify token still valid
  const { data: room } = await supabase
    .from("rooms")
    .select("id, name")
    .eq("guest_token", chat.guest_token)
    .single();

  if (!room) {
    return sendMessage(chatId, "❌ This jam's link has been regenerated. Ask the host for a new one and use /start &lt;token&gt; to reconnect.");
  }

  // Search
  let track;
  try {
    const yt = await getYTMusic();
    const songs = await yt.searchSongs(query.trim());
    if (!songs || songs.length === 0) {
      return sendMessage(chatId, `❌ No results found for "${query}".`);
    }
    const top = songs[0];
    track = {
      videoId: top.videoId,
      title: top.name,
      artist: top.artist?.name || "",
      duration: formatDuration(top.duration),
      thumbnail: top.thumbnails?.[top.thumbnails.length - 1]?.url || null,
    };
  } catch {
    return sendMessage(chatId, "❌ Search is unavailable right now. Try again in a moment.");
  }

  if (!/^[a-zA-Z0-9_-]{11}$/.test(track.videoId)) {
    return sendMessage(chatId, "❌ Couldn't find a valid result. Try a different search.");
  }

  const safeThumbnail =
    typeof track.thumbnail === "string" && track.thumbnail.startsWith("https://i.ytimg.com/")
      ? track.thumbnail
      : null;

  // Duplicate check
  const { data: existing } = await supabase
    .from("tracks")
    .select("id")
    .eq("room_id", room.id)
    .eq("video_id", track.videoId)
    .in("status", ["queued", "playing"])
    .limit(1);

  if (existing && existing.length > 0) {
    return sendMessage(chatId, `⚠️ <b>${track.title}</b> is already in the queue.`);
  }

  const { error } = await supabase.from("tracks").insert({
    room_id: room.id,
    video_id: track.videoId,
    title: track.title.toString().slice(0, 200),
    artist: track.artist.toString().slice(0, 200),
    thumbnail: safeThumbnail,
    duration: track.duration || null,
    added_by: "Telegram",
    device_id: null,
  });

  if (error) {
    return sendMessage(chatId, "❌ Couldn't add that track. Try again.");
  }

  return sendMessage(chatId, `🎵 Added <b>${track.title}</b> by ${track.artist} to the queue!`);
}

async function handleQueue(chatId, supabase) {
  const { data: chat } = await supabase
    .from("telegram_chats")
    .select("guest_token")
    .eq("chat_id", chatId)
    .single();

  if (!chat) {
    return sendMessage(chatId, "No jam active. Use /start &lt;token&gt; to connect.");
  }

  const { data: room } = await supabase
    .from("rooms")
    .select("id, name")
    .eq("guest_token", chat.guest_token)
    .single();

  if (!room) {
    return sendMessage(chatId, "❌ This jam's link has been regenerated. Ask the host for a new one.");
  }

  const { data: tracks } = await supabase
    .from("tracks")
    .select("title, artist, status, position")
    .eq("room_id", room.id)
    .in("status", ["playing", "queued"])
    .order("status", { ascending: false })
    .order("position", { ascending: true })
    .limit(10);

  if (!tracks || tracks.length === 0) {
    return sendMessage(chatId, "Queue is empty. Use /add &lt;song&gt; to add one!");
  }

  const lines = tracks.map((t, i) => {
    if (t.status === "playing") return `▶️ <b>${t.title}</b> by ${t.artist}`;
    return `${i}. ${t.title} by ${t.artist}`;
  });

  return sendMessage(chatId, `<b>${room.name}</b>\n\n${lines.join("\n")}`);
}

async function handlePlaying(chatId, supabase) {
  const { data: chat } = await supabase
    .from("telegram_chats")
    .select("guest_token")
    .eq("chat_id", chatId)
    .single();

  if (!chat) {
    return sendMessage(chatId, "No jam active. Use /start &lt;token&gt; to connect.");
  }

  const { data: room } = await supabase
    .from("rooms")
    .select("id")
    .eq("guest_token", chat.guest_token)
    .single();

  if (!room) {
    return sendMessage(chatId, "❌ This jam's link has been regenerated. Ask the host for a new one.");
  }

  const { data: track } = await supabase
    .from("tracks")
    .select("title, artist, added_by")
    .eq("room_id", room.id)
    .eq("status", "playing")
    .single();

  if (!track) {
    return sendMessage(chatId, "Nothing playing right now.");
  }

  return sendMessage(
    chatId,
    `▶️ <b>${track.title}</b> by ${track.artist}\nAdded by ${track.added_by}`
  );
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const message = body?.message;

  if (!message?.text) return NextResponse.json({ ok: true });

  const chatId = message.chat.id;
  const text = message.text.trim();
  const supabase = getServiceSupabase();

  if (text.startsWith("/start ") || text === "/start") {
    const args = text.slice(7);
    await handleStart(chatId, args, supabase);
  } else if (text.startsWith("/add ") || text === "/add") {
    const query = text.slice(5);
    await handleAdd(chatId, query, supabase);
  } else if (text === "/queue") {
    await handleQueue(chatId, supabase);
  } else if (text === "/playing") {
    await handlePlaying(chatId, supabase);
  } else {
    await sendMessage(
      chatId,
      "Commands:\n/start &lt;token&gt; — connect to a jam\n/add &lt;song&gt; — add a song\n/queue — see what's coming up\n/playing — see what's on now"
    );
  }

  return NextResponse.json({ ok: true });
}

// Telegram sends a GET when verifying the webhook
export async function GET() {
  return NextResponse.json({ ok: true, service: "Aux Telegram Bot" });
}
