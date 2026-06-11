"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUser, getSession, signInWithGoogle, signOut } from "@/lib/auth";

function getFirstName(user) {
  const full = user?.user_metadata?.name || user?.email || "";
  return full.split(" ")[0];
}

function saveHostTokenLocally(hostToken, roomName) {
  localStorage.setItem("aux-host-token", hostToken);
  localStorage.setItem("aux-host-room-name", roomName);
  localStorage.setItem("aux-host-saved-at", Date.now().toString());
}

function getLocalHostRoom() {
  const hostToken = localStorage.getItem("aux-host-token");
  const roomName = localStorage.getItem("aux-host-room-name");
  const savedAt = parseInt(localStorage.getItem("aux-host-saved-at") || "0");
  // Only valid within 24h (matches cron window)
  if (!hostToken || Date.now() - savedAt > 24 * 60 * 60 * 1000) return null;
  return { hostToken, roomName };
}

export default function Landing() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const [activeRoom, setActiveRoom] = useState(null);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const u = await getUser();
      setUser(u);

      if (u) {
        // Logged-in: check DB for active room
        const session = await getSession();
        const res = await fetch("/api/rooms/active", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.room) setActiveRoom(data.room);
        }
      } else {
        // Anonymous: check localStorage
        const local = getLocalHostRoom();
        if (local) setActiveRoom({ hostToken: local.hostToken, name: local.roomName });
      }

      setUserLoading(false);
    })();
  }, []);

  const defaultRoomName = user ? `${getFirstName(user)}'s Jam` : "Jam";
  const placeholder = user ? `${getFirstName(user)}'s Jam` : "Name your jam (optional)";

  async function createRoom() {
    setBusy(true);
    setError(null);
    try {
      const session = await getSession();
      const headers = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: name.trim() || defaultRoomName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create the room.");
      // Save host token locally for anonymous rejoin
      saveHostTokenLocally(data.hostToken, data.name);
      router.push(`/host/${data.hostToken}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <div className="brand" style={{ justifyContent: "space-between" }}>
        <span className="brand-mark">
          Aux<span className="dot">.</span>
        </span>
        {!userLoading && (
          <div className="auth-bar">
            {user && (
              <div className="auth-user">
                <span className="muted" style={{ fontSize: "0.85rem" }}>
                  {user.user_metadata?.name || user.email}
                </span>
                <button
                  className="btn-quiet"
                  onClick={async () => {
                    await signOut();
                    setUser(null);
                    setActiveRoom(null);
                  }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {!userLoading && !user && (
        <div className="premium-nudge">
          <span className="nudge-icon">★</span>
          Signing in unlocks your YouTube Premium for ad-free playback.{" "}
          <button className="nudge-link" onClick={signInWithGoogle}>
            Sign in with Google
          </button>
        </div>
      )}

      {!userLoading && activeRoom && (
        <div className="rejoin-banner">
          <div>
            <div style={{ fontWeight: 700 }}>{activeRoom.name}</div>
            <div className="muted" style={{ fontSize: "0.85rem" }}>
              Your jam is still running
            </div>
          </div>
          <button
            className="btn"
            onClick={() => router.push(`/host/${activeRoom.host_token || activeRoom.hostToken}`)}
          >
            Rejoin →
          </button>
        </div>
      )}

      <section className="hero">
        <h1>
          One speaker.
          <br />
          Everyone&apos;s <em>queue</em>.
        </h1>
        <p>
          Start a jam, plug this device into the speaker, and share the link.
          Friends add and upvote songs from their phones — no app, no login.
          Playback runs on YouTube.
        </p>

        <div className="create-row">
          <input
            className="input"
            placeholder={placeholder}
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !busy && createRoom()}
          />
          <button className="btn" onClick={createRoom} disabled={busy}>
            {busy ? "Starting…" : "Start a jam"}
          </button>
        </div>
        {error && (
          <p className="muted" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
