"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Landing() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  async function createRoom() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || "Jam" }),
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
      <div className="brand">
        <span className="brand-mark">
          Aux<span className="dot">.</span>
        </span>
      </div>

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
            placeholder="Name your jam (optional)"
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
