# Aux — pass the aux, keep the vibe

A shared music queue for YouTube Music, in the spirit of Spotify Jam. One
host device plays through the official YouTube embedded player; everyone
else joins via an unguessable link or QR code to search, add, and upvote
songs. No app, no login.

## How it works

- **Host** creates a room and keeps their browser tab open — that tab is
  the speaker (YouTube IFrame Player API).
- **Guests** open `/jam/<token>` on their phones, search songs (via the
  unofficial `ytmusic-api` scraper, server-side), and add/upvote.
- **Queue state** lives in Supabase; clients stay in sync via Supabase
  Realtime. The queue plays highest-votes-first, oldest-first on ties.
- **Security model**: unguessable 24-char tokens, Spotify-Jam style. The
  host can regenerate the guest link at any time to lock out old links.
  All writes go through API routes using the service role key; the anon
  key is read-only.

## Setup (~10 minutes)

### 1. Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the contents of
   `supabase/schema.sql`, and run it.
3. In **Project Settings → API**, copy:
   - Project URL
   - `anon` public key
   - `service_role` key (keep this secret)

### 2. Google OAuth (optional but recommended)

Enables host login for YouTube Premium passthrough and future Pro features.

**Google Cloud Console:**
1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create a project (or reuse one)
2. APIs & Services → OAuth consent screen → External → fill in app name + your email
3. APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application
4. Under **Authorised redirect URIs** add:
   `https://your-project.supabase.co/auth/v1/callback`
5. Copy the **Client ID** and **Client Secret**

**Supabase:**
1. Dashboard → Authentication → Providers → Google → Enable
2. Paste the Client ID and Client Secret
3. Copy the **Callback URL** shown — it should match what you added in Google Cloud

That's it. The `/auth/callback` route in the app handles the rest.

### 3. Local dev

```bash
npm install
cp .env.example .env.local   # fill in the three values
npm run dev
```

Open http://localhost:3000, start a jam, and open the guest link in a
second browser/phone to test.

### 4. Deploy to Vercel

1. Push this repo to GitHub.
2. Import it in Vercel (framework auto-detected: Next.js).
3. Add the three environment variables from `.env.example` in
   **Project → Settings → Environment Variables**.
4. Deploy. Done — share `yourapp.vercel.app`.

## Environment variables

| Variable | Where it's used |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | client + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client (read-only + realtime) |
| `SUPABASE_SERVICE_ROLE_KEY` | API routes only (writes) |

## Project structure

```
app/
  page.jsx               Landing — create a room
  host/[token]/page.jsx  Host view — player, queue control, invite ticket
  jam/[token]/page.jsx   Guest view — search, add, upvote
  api/
    rooms/route.js       POST  create room
    search/route.js      GET   YouTube Music search (ytmusic-api)
    tracks/route.js      POST  add a track (guest token required)
    vote/route.js        POST  upvote (atomic, via SQL function)
    host/route.js        POST  host actions: play_next, remove,
                               regenerate_guest_token
lib/supabase.js          Clients + token generator
supabase/schema.sql      Tables, RLS, realtime, vote function
```

## Things to know

- **Browser autoplay**: the host must click "Start the music" once — a
  user gesture is required before browsers allow audio. After that,
  tracks auto-advance.
- **Car mode (iOS):** Play a track → tap fullscreen → tap the PiP button
  → swipe home → lock your phone. Music and queue auto-advance will keep
  running. The fullscreen step is required — PiP without it won't survive
  the lock. Plug into a charger for long drives. Android untested.
- **Search is unofficial**: `ytmusic-api` scrapes the YT Music web
  client and can break without notice. `app/api/search/route.js` is the
  one file to swap if you move to the official YouTube Data API
  (key + quota required).
- **Playback is official**: songs play through the YouTube IFrame
  player, which keeps you within YouTube's intended embed usage. Don't
  paywall playback itself — YouTube's API terms prohibit charging for
  access to their content.
- **Cleanup**: rooms live forever in this starter. A simple cron (Vercel
  Cron or Supabase scheduled function) deleting rooms older than ~24h is
  a good first addition.

## Ideas for v2

- Host "freeze queue" toggle and per-guest add limits
- Played-history view / export the night as a playlist
- One-time party pass or venue subscription (charge for features,
  not for playback)
