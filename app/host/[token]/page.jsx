"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import { getSupabase } from "@/lib/supabase";

export default function HostPage() {
  const { token } = useParams();
  const [room, setRoom] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [started, setStarted] = useState(false);
  const [toast, setToast] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const playerRef = useRef(null);
  const playerReadyRef = useRef(false);
  const advancingRef = useRef(false);
  const roomRef = useRef(null);

  const nowPlaying = tracks.find((t) => t.status === "playing") || null;
  const queue = tracks
    .filter((t) => t.status === "queued")
    .sort(
      (a, b) =>
        b.votes - a.votes || new Date(a.created_at) - new Date(b.created_at)
    );

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
      roomRef.current = r;
      fetchTracks(r.id);
      channel = getSupabase()
        .channel(`room-${r.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "tracks",
            filter: `room_id=eq.${r.id}`,
          },
          () => fetchTracks(r.id)
        )
        .subscribe();
    })();
    return () => channel && getSupabase().removeChannel(channel);
  }, [token, fetchTracks]);

  async function hostAction(action, trackId) {
    const res = await fetch("/api/host", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostToken: token, action, trackId }),
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

  // If we're live and idle but songs arrive, advance automatically
  useEffect(() => {
    if (started && !nowPlaying && queue.length > 0) playNext();
  }, [started, nowPlaying, queue.length, playNext]);

  async function startMusic() {
    setStarted(true);
    // Resume a track that was already marked playing (e.g. after refresh)
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
        <span className="brand-room">{room ? room.name : "loading…"}</span>
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
              <ul className="queue">
                {queue.map((t) => (
                  <li className="queue-item" key={t.id}>
                    {t.thumbnail && <img src={t.thumbnail} alt="" />}
                    <div className="qi-main">
                      <div className="qi-title">{t.title}</div>
                      <div className="qi-sub">
                        {t.artist}
                        {t.duration ? ` · ${t.duration}` : ""} · {t.added_by}
                      </div>
                    </div>
                    <span className="vote" aria-label={`${t.votes} votes`}>
                      <span className="arrow">▲</span>
                      <span className="count">{t.votes}</span>
                    </span>
                    <button
                      className="btn-quiet"
                      onClick={() => hostAction("remove", t.id)}
                      aria-label={`Remove ${t.title}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
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
              <button className="btn-quiet" onClick={regenerateLink}>
                Regenerate link
              </button>
            </div>
          </div>

          <div className="card section-gap">
            <h2>Host notes</h2>
            <p className="muted" style={{ fontSize: "0.88rem", margin: 0 }}>
              Keep this tab open — it&apos;s the speaker. Anyone with the link
              can add and upvote songs. Regenerating the link blocks new
              joins on the old one. Bookmark this page&apos;s URL to get back
              in as host.
            </p>
          </div>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
