# Aux — pass the aux, keep the vibe

A shared music queue built on YouTube. One host device plays through the
official YouTube IFrame player; everyone else joins via an unguessable link
or QR code to search, add, and upvote songs. No app, no login required for
guests.

## How it works

- **Host** creates a room, keeps their browser tab open — that tab is the
  speaker. Optionally signs in with Google to inherit YouTube Premium
  (ad-free playback) and unlock Pro features later.
- **Guests** open `/jam/<token>` on their phones. No account needed. They
  get a random display name (e.g. "Disco Otter 42"), can search YouTube
  Music, add songs, upvote, and remove their own additions.
- **Queue** plays highest-votes-first, oldest-first on ties. Auto-advances
  when a track ends.
- **Host controls**: skip, remove any track, add songs directly from the
  host page, rename the room inline, and regenerate the guest link to
  invalidate old shares.
- **Security**: unguessable 24-char tokens (Spotify Jam style). All writes
  go through API routes using the service role key. The anon key is
  read-only. Guest remove is gated by a device ID stored in localStorage.
- **Realtime**: queue state lives in Supabase, synced via Supabase Realtime.
  All connected clients update instantly.
- **Cleanup**: a Vercel Cron job runs nightly at 3am UTC and deletes rooms
  older than 24 hours.

## Car mode (iOS)

Play a track → tap fullscreen → tap the PiP button → swipe home → lock
phone. Music and queue auto-advance keep running. The fullscreen step is
required — skipping it breaks PiP on lock. Plug into a charger for long
drives. Android untested.

## Setup (~15 minutes)

### 1. Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the contents of
   `supabase/schema.sql`, and run it.
3. Run these two additional lines (added after initial setup):
   ```sql
   alter table tracks add column if not exists device_id text;
   alter table rooms add column if not exists user_id uuid references auth.users(id) on delete set null;
   alter table rooms add column if not exists pro boolean not null default false;
   ```
4. Revoke public execute on the vote function:
   ```sql
   revoke execute on function public.increment_votes(uuid) from anon;
   revoke execute on function public.increment_votes(uuid) from authenticated;
   ```
5. In **Project Settings → API**, copy:
   - Project URL
   - `anon` public key
   - `service_role` key (keep this secret)
6. In **Authentication → URL Configuration**, set:
   - **Site URL**: `https://your-app.vercel.app`
   - **Redirect URLs**: `https://your-app.vercel.app/**`

### 2. Google OAuth (optional but recommended)

Enables host login for YouTube Premium passthrough and future Pro features.

**Google Cloud Console:**
1. Go to [console.cloud.google.com](https://console.cloud.google.com) →
   create or select a project
2. APIs & Services → Credentials → Create Credentials → OAuth client ID →
   Web application
3. Under **Authorised redirect URIs** add:
   `https://your-project.supabase.co/auth/v1/callback`
4. Copy the **Client ID** and **Client Secret**

**Supabase:**
1. Dashboard → Authentication → Providers → Google → Enable
2. Paste the Client ID and Client Secret
3. Confirm the Callback URL matches what you added in Google Cloud

### 3. Deploy to Vercel

1. Push this repo to GitHub.
2. Import it in Vercel (framework: Next.js, auto-detected).
3. Add environment variables in **Project → Settings → Environment Variables**:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `CRON_SECRET` | Any long random string |

4. Deploy. Share `yourapp.vercel.app`.

## Project structure

```
app/
  page.jsx                   Landing — create a room, sign in with Google
  login/page.jsx             Standalone login page
  host/[token]/page.jsx      Host view — player, queue, search, invite ticket
  jam/[token]/page.jsx       Guest view — search, add, upvote, played history
  auth/
    callback/route.js        Supabase OAuth callback handler
  api/
    rooms/route.js           POST  create room (attaches user_id if logged in)
    rooms/rename/route.js    POST  rename room (host token required)
    search/route.js          GET   YouTube Music search (ytmusic-api)
    tracks/route.js          POST  guest adds a track
    tracks/delete/route.js   POST  guest removes their own track (device_id gated)
    vote/route.js            POST  upvote a track (atomic SQL function)
    host/route.js            POST  host actions: play_next, remove,
                                   add_track, regenerate_guest_token
    cleanup/route.js         GET   delete rooms older than 24h (cron only)
lib/
  supabase.js                Browser + service role clients, token generator
  auth.js                    Google OAuth helpers, session access
supabase/
  schema.sql                 Tables, RLS policies, realtime, vote function
vercel.json                  Cron schedule (3am UTC daily)
```

## Things to know

- **Browser autoplay**: the host must click "Start the music" once — browsers
  require a user gesture before allowing audio. Tracks auto-advance after that.
- **Playback is official**: songs play through the YouTube IFrame player.
  Don't paywall playback — YouTube's API terms prohibit charging for access
  to their content. Charge for your features instead.
- **Search is unofficial**: `ytmusic-api` scrapes the YouTube Music web client
  and can break without notice. `app/api/search/route.js` is the single file
  to swap if you move to the official YouTube Data API (requires a key + quota).
- **YouTube Premium**: if the host is signed into YouTube Premium in the same
  browser, embedded videos play ad-free automatically. No extra setup needed.
- **Guest identity**: guests get a random name (e.g. "Purple Walrus 42") stored
  in localStorage plus a UUID device ID used for ownership checks. Neither
  requires an account.
- **Pro flag**: a `pro` boolean column exists on the `rooms` table for future
  gating. Flip it manually in Supabase for now.

## Roadmap

- Permanent rooms tied to host account (Pro)
- Played history visible to guests (Pro)
- Changeable guest nicknames
- Host freeze-queue toggle
- Room expiry configurable per host
