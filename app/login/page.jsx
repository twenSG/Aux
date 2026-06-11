"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithGoogle, getSession } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();

  // Already logged in — go home
  useEffect(() => {
    getSession().then((s) => {
      if (s) router.replace("/");
    });
  }, [router]);

  return (
    <main className="shell" style={{ maxWidth: 420 }}>
      <div className="brand">
        <span className="brand-mark">
          Aux<span className="dot">.</span>
        </span>
      </div>

      <div className="card" style={{ marginTop: 48, textAlign: "center" }}>
        <p style={{ margin: "0 0 24px", color: "var(--muted)", fontSize: "0.95rem" }}>
          Sign in to save your rooms and get YouTube Premium playback if
          you&apos;re already subscribed.
        </p>
        <button className="btn" style={{ width: "100%" }} onClick={signInWithGoogle}>
          Continue with Google
        </button>
      </div>
    </main>
  );
}
