"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

const NAMES = [
  "Purple Walrus",
  "Disco Otter",
  "Velvet Moose",
  "Neon Heron",
  "Mellow Lynx",
  "Cosmic Badger",
  "Golden Tapir",
  "Quiet Falcon",
];

function getIdentity() {
  if (typeof window === "undefined") return "Someone";
  let name = localStorage.getItem("aux-name");
  if (!name) {
    name =
      NAMES[Math.floor(Math.random() * NAMES.length)] +
      " " +
      Math.floor(Math.random() * 90 + 10);
    localStorage.setItem("aux-name", name);
  }
  return name;
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

  const [votedIds, setVotedIds] = useState(new Set());
  const debounceRef = useRef(null);

  const nowPlaying = tracks.find((t) => t.status === "playing") || null;
  const queue = tracks
    .filter((t) => t.status === "queued")
    .sort(
      (a, b) =>
        b.votes - a.votes || new Date(a.created_at) - new Date(b.created_at)
    );

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  const fetchRoomAndTracks = useCallback(async () => {
    if (!token) return;

    setNotFound(false);

    // Room
    const roomRes = await fetch(
      `/api/guest/room?guestToken=${encodeURIComponent(token)}`
    );
    if (!roomRes.ok) {
      setNotFound(true);
      return;
    }
    const roomData = await roomRes.json();
    setRoom(roomData.room);

    // Tracks
    const tracksRes = await fetch(
      `/api/guest/tracks?guestToken=${encodeURIComponent(token)}`
    );
    if (!tracksRes.ok) {
      setTracks([]);
      return;
    }
    const tracksData = await tracksRes.json();
    setTracks(tracksData.tracks || []);
  }, [token]);

  useEffect(() => {
    setVotedIds(
      new Set(JSON.parse(localStorage.getItem("aux-voted") || "[]"))
    );
  }, []);

  useEffect(() => {
    fetchRoomAndTracks();
  }, [fetchRoomAndTracks]);

  // Debounced search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results || []);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  async function addTrack(r) {
    const res = await fetch("/api/tracks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestToken: token,
        videoId: r.videoId,
        title: r.title,
        artist: r.artist,
        thumbnail: r.thumbnail,
        duration: r.duration,
        addedBy: getIdentity(),
      }),
    });

    const data = await res.json();
    if (res.ok) {
      showToast(`Added “${r.title}”`);
      setQuery("");
      setResults([]);
      // refresh queue
      fetchRoomAndTracks();
    } else {
      showToast(data.error || "Couldn't add that one.");
    }
  }

  async function vote(trackId) {
    if (votedIds.has(trackId)) return;

    const next = new Set(votedIds).add(trackId);
    setVotedIds(next);
    localStorage.setItem("aux-voted", JSON.stringify([...next]));

    const res = await fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestToken: token, trackId }),
    });

    // refresh vote counts after write
    if (res.ok) fetchRoomAndTracks();
  }

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
        <span className="brand-mark">
          Aux<span className="dot">.</span>
        </span>
        <span className="brand-room">{room ? room.name : "loading…"}</span>
      </div>

      <div className="card">
        <h2>Add a song</h2>
        <p
          className="muted"
          style={{ fontSize: "0.85rem", margin: "-4px 0 12px" }}
        >
          Adding as{" "}
          <strong style={{ color: "var(--text)" }}>{getIdentity()}</strong>
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
                  <div className="qi-sub">
                    {r.artist}
                    {r.duration ? ` · ${r.duration}` : ""}
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
          <ul className="queue">
            {queue.map((t) => (
              <li className="queue-item" key={t.id}>
                {t.thumbnail && <img src={t.thumbnail} alt="" />}
                <div className="qi-main">
                  <div className="qi-title">{t.title}</div>
                  <div className="qi-sub">
                    {t.artist} · {t.added_by}
                  </div>
                </div>

                <button
                  className={`vote ${votedIds.has(t.id) ? "voted" : ""}`}
                  onClick={() => vote(t.id)}
                  aria-label={`Upvote ${t.title}`}
                >
                  <span className="arrow">▲</span>
                  <span className="count">{t.votes}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
