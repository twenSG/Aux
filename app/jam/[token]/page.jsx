"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const NAMES = [
  "Purple Walrus", "Disco Otter", "Velvet Moose", "Neon Heron",
  "Mellow Lynx", "Cosmic Badger", "Golden Tapir", "Quiet Falcon",
];

function getIdentity() {
  if (typeof window === "undefined") return { name: "Someone", deviceId: null };
  let name = localStorage.getItem("aux-name");
  if (!name) {
    name = NAMES[Math.floor(Math.random() * NAMES.length)] + " " + Math.floor(Math.random() * 90 + 10);
    localStorage.setItem("aux-name", name);
  }
  let deviceId = localStorage.getItem("aux-device-id");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("aux-device-id", deviceId);
  }
  return { name, deviceId };
}

function SortableTrack({ track, onRemove, deviceId }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: track.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isOwn = track.device_id === deviceId;

  return (
    <li ref={setNodeRef} style={style} className="queue-item">
      <span className="drag-handle" {...attributes} {...listeners} aria-label="Drag to reorder">
        ⠿
      </span>
      {track.thumbnail && <img src={track.thumbnail} alt="" />}
      <div className="qi-main">
        <div className="qi-title">{track.title}</div>
        <div className="qi-sub">{track.artist} · {track.added_by}</div>
      </div>
      {isOwn && (
        <button
          className="btn-quiet"
          onClick={() => onRemove(track.id, track.title)}
          aria-label={`Remove ${track.title}`}
        >
          ✕
        </button>
      )}
    </li>
  );
}

export default function GuestPage() {
  const { token } = useParams();
  const [room, setRoom] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [tracks, setTracks] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [toast, setToast] = useState(null);
  const [identity, setIdentity] = useState({ name: "Someone", deviceId: null });
  const debounceRef = useRef(null);
  const reorderDebounceRef = useRef(null);

  useEffect(() => { setIdentity(getIdentity()); }, []);

  const nowPlaying = tracks.find((t) => t.status === "playing") || null;
  const queue = tracks
    .filter((t) => t.status === "queued")
    .sort((a, b) => a.position - b.position || new Date(a.created_at) - new Date(b.created_at));
  const played = tracks.filter((t) => t.status === "played").reverse();

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  const fetchTracks = useCallback(async (roomId) => {
    const { data } = await getSupabase()
      .from("tracks")
      .select("*")
      .eq("room_id", roomId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    setTracks(data || []);
  }, []);

  useEffect(() => {
    let channel;
    (async () => {
      const { data: r } = await getSupabase()
        .from("rooms")
        .select("id, name")
        .eq("guest_token", token)
        .single();
      if (!r) { setNotFound(true); return; }
      setRoom(r);
      fetchTracks(r.id);
      channel = getSupabase()
        .channel(`room-${r.id}-guest`)
        .on("postgres_changes", {
          event: "DELETE", schema: "public", table: "tracks",
          filter: `room_id=eq.${r.id}`,
        }, (payload) => {
          setTracks((prev) => prev.filter((t) => t.id !== payload.old.id));
        })
        .on("postgres_changes", {
          event: "*", schema: "public", table: "tracks",
          filter: `room_id=eq.${r.id}`,
        }, (payload) => {
          if (payload.eventType !== "DELETE") fetchTracks(r.id);
        })
        .subscribe();
    })();
    return () => channel && getSupabase().removeChannel(channel);
  }, [token, fetchTracks]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results || []);
      } finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  async function addTrack(r) {
    const res = await fetch("/api/tracks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestToken: token, videoId: r.videoId, title: r.title,
        artist: r.artist, thumbnail: r.thumbnail, duration: r.duration,
        addedBy: identity.name, deviceId: identity.deviceId,
      }),
    });
    const data = await res.json();
    if (res.ok) { showToast(`Added "${r.title}"`); setQuery(""); setResults([]); }
    else showToast(data.error || "Couldn't add that one.");
  }

  async function removeTrack(trackId, title) {
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
    const res = await fetch("/api/tracks/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestToken: token, trackId, deviceId: identity.deviceId }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (room) fetchTracks(room.id);
      showToast(data.error || "Couldn't remove that one.");
    } else {
      showToast(`Removed "${title}"`);
    }
  }

  function persistReorder(orderedIds) {
    clearTimeout(reorderDebounceRef.current);
    reorderDebounceRef.current = setTimeout(() => {
      fetch("/api/tracks/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, tokenType: "guest", orderedIds }),
      });
    }, 500);
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setTracks((prev) => {
      const queued = prev
        .filter((t) => t.status === "queued")
        .sort((a, b) => a.position - b.position || new Date(a.created_at) - new Date(b.created_at));
      const others = prev.filter((t) => t.status !== "queued");
      const oldIndex = queued.findIndex((t) => t.id === active.id);
      const newIndex = queued.findIndex((t) => t.id === over.id);
      const reordered = arrayMove(queued, oldIndex, newIndex).map((t, i) => ({ ...t, position: i }));
      persistReorder(reordered.map((t) => t.id));
      return [...others, ...reordered];
    });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  if (notFound) {
    return (
      <main className="shell">
        <p className="empty">
          This link doesn&apos;t open any jam — it may have been regenerated.
          Ask the host for a fresh one.
        </p>
      </main>
    );
  }

  return (
    <main className="shell" style={{ maxWidth: 560 }}>
      <div className="brand">
        <span className="brand-mark">Aux<span className="dot">.</span></span>
        <span className="brand-room">{room ? room.name : "loading…"}</span>
      </div>

      <div className="card">
        <h2>Add a song</h2>
        <p className="muted" style={{ fontSize: "0.85rem", margin: "-4px 0 12px" }}>
          Adding as <strong style={{ color: "var(--text)" }}>{identity.name}</strong>
        </p>
        <div className="search-row">
          <input
            className="input"
            placeholder="Search YouTube Music…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            inputMode="search"
          />
        </div>
        {searching && <p className="muted">Searching…</p>}
        {results.length > 0 && (
          <ul className="results">
            {results.map((r) => (
              <li className="queue-item" key={r.videoId}>
                {r.thumbnail && <img src={r.thumbnail} alt="" />}
                <div className="qi-main">
                  <div className="qi-title">{r.title}</div>
                  <div className="qi-sub">{r.artist}{r.duration ? ` · ${r.duration}` : ""}</div>
                </div>
                <button className="btn-quiet" style={{ flexShrink: 0 }} onClick={() => addTrack(r)}>
                  + Add
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {nowPlaying && (
        <div className="card section-gap">
          <h2>Now playing</h2>
          <div className="now-playing" style={{ marginTop: 0 }}>
            {nowPlaying.thumbnail && <img src={nowPlaying.thumbnail} alt="" />}
            <div>
              <div className="np-title">{nowPlaying.title}</div>
              <div className="np-artist">{nowPlaying.artist}</div>
            </div>
          </div>
        </div>
      )}

      <div className="card section-gap">
        <h2>Up next · {queue.length}</h2>
        {queue.length === 0 ? (
          <p className="empty">Queue&apos;s empty. You know what to do.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={queue.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <ul className="queue">
                {queue.map((t) => (
                  <SortableTrack
                    key={t.id}
                    track={t}
                    onRemove={removeTrack}
                    deviceId={identity.deviceId}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {played.length > 0 && (
        <div className="card section-gap">
          <h2>Played · {played.length}</h2>
          <ul className="queue">
            {played.map((t) => (
              <li className="queue-item" key={t.id} style={{ opacity: 0.5 }}>
                {t.thumbnail && <img src={t.thumbnail} alt="" />}
                <div className="qi-main">
                  <div className="qi-title">{t.title}</div>
                  <div className="qi-sub">{t.artist} · {t.added_by}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
