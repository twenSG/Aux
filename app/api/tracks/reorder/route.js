import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

// Accepts an ordered array of track IDs and writes position values.
// Authenticated by either host token or guest token — both can reorder.

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { token, tokenType, orderedIds } = body;

  if (!token || !tokenType || !Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Verify token and get room
  const { data: room } = await supabase
    .from("rooms")
    .select("id")
    .eq(tokenType === "host" ? "host_token" : "guest_token", token)
    .single();

  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  // Write positions in parallel
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from("tracks")
        .update({ position: index })
        .eq("id", id)
        .eq("room_id", room.id)
        .eq("status", "queued")
    )
  );

  return NextResponse.json({ ok: true });
}
