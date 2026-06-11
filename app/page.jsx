"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUser, getSession, signInWithGoogle, signOut } from "@/lib/auth";

function getFirstName(user) {
  const full = user?.user_metadata?.name || user?.email || "";
  return full.split(" ")[0];
}

export default function Landing() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    getUser()
      .then(setUser)
      .finally(() => setUserLoading(false));
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
            {user ? (
              <div className="auth-user">
                <span className="muted" style={{ fontSize: "0.85rem" }}>
                  {user.user_metadata?.name || user.email}
                </span>
                <button
                  className="btn-quiet"
                  onClick={async () => {
                    await signOut();
                    setUser(null);
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
