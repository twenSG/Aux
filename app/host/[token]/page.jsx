"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
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

function SortableTrack({ track, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: track.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} className="queue-item">
      <span className="drag-handle" {...attributes} {...listeners} aria-label="Drag to reorder">
        ⠿
      </span>
      {track.thumbnail && <img src={track.thumbnail} alt="" />}
      <div className="qi-main">
        <div className="qi-title">{track.title}</div>
        <div className="qi-sub">
          {track.artist}{track.duration ? ` · ${track.duration}` : ""} · {track.added_by}
        </div>
      </div>
      <button
        className="btn-quiet"
        onClick={() => onRemove(track.id)}
        aria-label={`Remove ${track.title}`}
      >
        ✕
      </button>
    </li>
  );
}

export default function HostPage() {
  const { token } = useParams();
  const [room, setRoom] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [started, setStarted] = useState(false);
  const [toast, setToast] = useState(null);
  const [notFound, setNotFound] = useState(false);

  // Inline rename state
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const nameInputRef = useRef(null);

  // Room expiry countdown
  const [timeLeft, setTimeLeft] = useState(null);

  // Host search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchDebounceRef = useRef(null);
  const reorderDebounceRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const playerRef = useRef(null);
  const playerReadyRef = useRef(false);
  const advancingRef = useRef(false);
  const roomRef = useRef(null);

  const nowPlaying = tracks.find((t) => t.status === "playing") || null;
  const queue = tracks
    .filter((t) => t.status === "queued")
    .sort((a, b) => a.position - b.position || new Date(a.created_at) - new Date(b.created_at));

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const fetchTracks = useCallback(async (roomId) => {
    const { data } = await getSupabase()
      .from("tracks")
      .select("*")
      .eq("room_id", roomId)
      .neq("status", "played")
      .order("created_at", { ascending: true });
    setTracks(data || []);
  }, []);

  // Load room + subscribe to queue changes
  useEffect(() => {
    let channel;
    (async () => {
      const { data: r } = await getSupabase()
        .from("rooms")
        .select("*")
        .eq("host_token", token)
        .single();
      if (!r) {
        setNotFound(true);
        return;
      }
      setRoom(r);
      setNameInput(r.name);
      roomRef.current = r;

      // Start countdown from room creation time
      function updateCountdown() {
        const expiresAt = new Date(r.created_at).getTime() + 24 * 60 * 60 * 1000;
        const diff = expiresAt - Date.now();
        if (diff <= 0) { setTimeLeft("Expired"); return; }
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        setTimeLeft(`${h}h ${m}m`);
      }
      updateCountdown();
      const interval = setInterval(updateCountdown, 60000);
      return () => clearInterval(interval);
      fetchTracks(r.id);
      channel = getSupabase()
        .channel(`room-${r.id}`)
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "tracks",
            filter: `room_id=eq.${r.id}`,
          },
          (payload) => {
            setTracks((prev) => prev.filter((t) => t.id !== payload.old.id));
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "tracks",
            filter: `room_id=eq.${r.id}`,
          },
          (payload) => {
            if (payload.eventType !== "DELETE") fetchTracks(r.id);
          }
        )
        .subscribe();
    })();
    return () => channel && getSupabase().removeChannel(channel);
  }, [token, fetchTracks]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

  // Debounced host search
  useEffect(() => {
    clearTimeout(searchDebounceRef.current);
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(data.results || []);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(searchDebounceRef.current);
  }, [searchQuery]);

  async function addTrack(r) {
    const data = await hostAction("add_track", null, r);
    if (data.ok) {
      showToast(`Added "${r.title}"`);
      setSearchQuery("");
      setSearchResults([]);
    } else {
      showToast(data.error || "Couldn't add that one.");
    }
  }

  async function saveName() {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === room.name) {
      setEditingName(false);
      setNameInput(room.name);
      return;
    }
    const res = await fetch("/api/rooms/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostToken: token, name: trimmed }),
    });
    if (res.ok) {
      setRoom((r) => ({ ...r, name: trimmed }));
      showToast("Room renamed.");
    }
    setEditingName(false);
  }

  async function hostAction(action, trackId, track) {
    const res = await fetch("/api/host", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostToken: token, action, trackId, track }),
    });
    return res.json();
  }

  const playNext = useCallback(async () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    try {
      const data = await hostAction("play_next");
      if (data.track && playerReadyRef.current) {
        playerRef.current.loadVideoById(data.track.video_id);
      }
      if (roomRef.current) fetchTracks(roomRef.current.id);
    } finally {
      advancingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, fetchTracks]);

  // YouTube IFrame Player
  useEffect(() => {
    function createPlayer() {
      playerRef.current = new window.YT.Player("yt-player", {
        width: "100%",
        height: "100%",
        playerVars: { playsinline: 1, rel: 0 },
        events: {
          onReady: () => {
            playerReadyRef.current = true;
          },
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.ENDED) playNext();
          },
          onError: (e) => {
            // Error codes: 2 invalid id, 5 html5 error, 100 not found,
            // 101/150 embed not allowed. Skip to next in all cases.
            console.warn("YouTube player error, skipping:", e.data);
            showToast("Couldn't play that one — skipping.");
            playNext();
          },
        },
      });
    }
    if (window.YT && window.YT.Player) {
      createPlayer();
    } else {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
      window.onYouTubeIframeAPIReady = createPlayer;
    }
    return () => {
      playerReadyRef.current = false;
      if (playerRef.current?.destroy) playerRef.current.destroy();
    };
  }, [playNext]);

  // If live and idle but songs arrive, advance automatically
  useEffect(() => {
    if (started && !nowPlaying && queue.length > 0) playNext();
  }, [started, nowPlaying, queue.length, playNext]);

  async function startMusic() {
    setStarted(true);
    if (nowPlaying && playerReadyRef.current) {
      playerRef.current.loadVideoById(nowPlaying.video_id);
    } else {
      playNext();
    }
  }

  async function regenerateLink() {
    const data = await hostAction("regenerate_guest_token");
    if (data.guestToken) {
      setRoom((r) => ({ ...r, guest_token: data.guestToken }));
      showToast("New link created — the old one is dead.");
    }
  }

  async function removeTrack(trackId) {
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
    const data = await hostAction("remove", trackId);
    if (!data.ok) {
      if (roomRef.current) fetchTracks(roomRef.current.id);
      showToast("Couldn't remove that track.");
    }
  }

  function persistReorder(orderedIds) {
    clearTimeout(reorderDebounceRef.current);
    reorderDebounceRef.current = setTimeout(() => {
      fetch("/api/tracks/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, tokenType: "host", orderedIds }),
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

  if (notFound) {
    return (
      <main className="shell">
        <p className="empty">
          This host link doesn&apos;t open any room. Start a new jam from the
          home page.
        </p>
      </main>
    );
  }

  const guestUrl =
    room && typeof window !== "undefined"
      ? `${window.location.origin}/jam/${room.guest_token}`
      : "";

  return (
    <main className="shell">
      <div className="brand">
        <span className="brand-mark">
          Aux<span className="dot">.</span>
        </span>

        {/* Inline editable room name */}
        {room && (
          editingName ? (
            <input
              ref={nameInputRef}
              className="room-name-input"
              value={nameInput}
              maxLength={60}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") {
                  setEditingName(false);
                  setNameInput(room.name);
                }
              }}
            />
          ) : (
            <button
              className="room-name-btn"
              onClick={() => setEditingName(true)}
              title="Click to rename"
            >
              {room.name}
              <span className="edit-icon">✎</span>
            </button>
          )
        )}
      </div>

      <div className="grid-host">
        <div>
          <div className="card">
            <h2>Now playing</h2>
            <div className="player-frame">
              <div id="yt-player" />
            </div>

            {nowPlaying ? (
              <div className="now-playing">
                {nowPlaying.thumbnail && (
                  <img src={nowPlaying.thumbnail} alt="" />
                )}
                <div>
                  <div className="np-title">{nowPlaying.title}</div>
                  <div className="np-artist">
                    {nowPlaying.artist}
                    {nowPlaying.added_by ? ` · added by ${nowPlaying.added_by}` : ""}
                  </div>
                </div>
              </div>
            ) : (
              <p className="np-meta section-gap">
                {queue.length > 0
                  ? "Songs are waiting."
                  : "Queue is empty — share the link below."}
              </p>
            )}

            <div className="ticket-actions" style={{ paddingLeft: 0 }}>
              {!started ? (
                <button
                  className="btn"
                  onClick={startMusic}
                  disabled={queue.length === 0 && !nowPlaying}
                >
                  Start the music
                </button>
              ) : (
                <button className="btn-quiet" onClick={playNext}>
                  Skip ▸
                </button>
              )}
            </div>
          </div>

          <div className="card section-gap">
            <h2>Up next · {queue.length}</h2>
            {queue.length === 0 ? (
              <p className="empty">Nothing queued yet.</p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={queue.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  <ul className="queue">
                    {queue.map((t) => (
                      <SortableTrack key={t.id} track={t} onRemove={removeTrack} />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        <div>
          <div className="ticket">
            <div className="ticket-top">
              <div className="ticket-qr">
                {guestUrl && <QRCodeCanvas value={guestUrl} size={108} />}
              </div>
              <div className="ticket-copy">
                <div className="label">Scan to join</div>
                <div className="url">{guestUrl}</div>
              </div>
            </div>
            <div className="ticket-divider" />
            <div className="ticket-actions">
              <button
                className="btn-quiet"
                onClick={() => {
                  navigator.clipboard.writeText(guestUrl);
                  showToast("Link copied.");
                }}
              >
                Copy link
              </button>
              {typeof navigator !== "undefined" && navigator.share && (
                <button
                  className="btn-quiet"
                  onClick={() =>
                    navigator.share({
                      title: room?.name || "Aux Jam",
                      text: "Add songs to the queue →",
                      url: guestUrl,
                    })
                  }
                >
                  Share link
                </button>
              )}
              <button className="btn-quiet" onClick={regenerateLink}>
                Regenerate link
              </button>
            </div>
          </div>

          <div className="card section-gap">
            <h2>Add a song</h2>
            <div className="search-row">
              <input
                className="input"
                placeholder="Search YouTube Music…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {searching && <p className="muted">Searching…</p>}
            {searchResults.length > 0 && (
              <ul className="results">
                {searchResults.map((r) => (
                  <li className="queue-item" key={r.videoId}>
                    {r.thumbnail && <img src={r.thumbnail} alt="" />}
                    <div className="qi-main">
                      <div className="qi-title">{r.title}</div>
                      <div className="qi-sub">
                        {r.artist}{r.duration ? ` · ${r.duration}` : ""}
                      </div>
                    </div>
                    <button className="btn-quiet" onClick={() => addTrack(r)}>
                      + Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card section-gap">
            <h2>Host notes</h2>
            <p className="muted" style={{ fontSize: "0.88rem", margin: 0 }}>
              Keep this tab open — it&apos;s the speaker. Anyone with the link
              can add and upvote songs. Regenerating the link blocks new
              joins on the old one. Bookmark this page&apos;s URL to get back
              in as host.
            </p>
            <p className="muted" style={{ fontSize: "0.88rem", margin: "10px 0 0" }}>
              <strong style={{ color: "var(--text)" }}>Car mode (iOS):</strong>{" "}
              play a track → fullscreen → PiP button → swipe home → lock phone.
              The fullscreen step is required. Plug in a charger for long drives.
            </p>
            {timeLeft && (
              <p className="muted" style={{ fontSize: "0.88rem", margin: "10px 0 0" }}>
                <strong style={{ color: timeLeft === "Expired" ? "var(--accent)" : "var(--text)" }}>
                  Room closes in:
                </strong>{" "}
                <span className="mono">{timeLeft}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
