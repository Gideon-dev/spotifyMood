# Moodify (spotify + mood engine)

**A mood-adaptive music engine built on top of Spotify.**

Moodify is a session-first, mood-driven music companion that uses Spotify for playback while providing rich behavioral analytics, mood-aware recommendations, and resilient offline-first logging. It’s designed as a production-ready analytics and recommendation foundation for mood and wellness music experiences.

---

## Quick links

- Live demo: https://spotify-mood-phi.vercel.app/
- Repo: https://github.com/Gideon-dev/spotifyMood
- Author: https://github.com/Gideon-dev || https://www.linkedin.com/in/akinloluwa-adeniran-86aa4a248/

---

## Features

**Playback & Control**
- Remote Spotify playback control (play / pause / seek / next / previous / volume / repeat / shuffle).
- Real-time UI sync via `GET /me/player` polling.
- Optional Web Playback SDK support (future, premium-required).

**Session / Mood**
- Start/end mood sessions (session-level analytics).
- Session → track linking for per-session insights.

**Recommendations**
- Server-side Spotify recommendations endpoint (`/api/recommendations`) with mood → seed mapping.
- Seed mapping example: `happy`, `sad`, `chill`, `energetic`, `focus`.

**Analytics & Logging**
- In-progress logs for currently-playing track.
- Deterministic finalization (`finalizeCurrentLog`) on next/prev/end/unload events.
- Heuristic skip detection and listened-duration calculation.
- Local durable queue (IndexedDB) with chunked flush, exponential backoff, and idempotency.
- Cross-tab consistency via BroadcastChannel.
- Server-side ingestion on Supabase with idempotent upsert.

**Auth & User**
- NextAuth with Spotify provider (access token refresh).
- Supabase users table & upsert on sign-in.

---

## Architecture (deep view)

                +---------------------------+
                |        User Device        |
                |  (Browser: Moodify UI)   |
                +-----------+---------------+
                            |
            (1) UI Actions    |   (2) Remote control (spotify.play())
            play/next/pause    |         Spotify Web API
                            v
+------------------------+ +----------------------+ +---------------------+
| Frontend (Next.js App) |--->| Playback Controller |--->| Spotify API |
| - React / Zustand | | - handlePlay() | | - /me/player |
| - usePlayback hook | | - resume/pause/seek | | - recommendations |
| - start/finalize logs | | | +---------------------+
+-----------+------------+
|
| (3) Analytics pipeline (client)
v
+---------------------------+ +-------------------------+
| In-progress log (memory) |--enqueue->| IndexedDB queue (local) |
| startTrackLog / finalize | | - chunked flush |
+---------------------------+ +-------------------------+
| |
| (4) /api/track-logs/flush (POST chunks) |
v v
+----------------------+ +-------------------+
| Next.js API routes | ----write----> | Supabase (mood_tracks)
| - /track-logs/flush | | - idempotent upsert
| - /spotify/track-features (fallback) +-------------------+
+----------------------+

yaml
Copy code

---

## Folder (canonical) — adjust to your repo

app/
api/
mood-session/
recommendations/
track-logs/
spotify/
track-features/ <-- fallback endpoint
page.tsx
lib/
db/
session.ts
tracks.ts
Playback/
handlePlay.ts
loggingHelpers.ts
usePlayback.ts
spotifyClient.ts
components/
Player/
MoodSelector/
store/
usePlaybackStore.ts

yaml
Copy code

---

## Environment (required)

Set in `.env.local`:

NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://127.0.0.1:3000
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

markdown
Copy code

**Spotify redirect URIs** (developer dashboard):

http://127.0.0.1:3000/api/auth/callback/spotify
https://spotify-mood-phi.vercel.app/api/auth/callback/spotify

yaml
Copy code

---

## Setup (local dev)

1. Install dependencies:
   ```bash
   npm install
   # or
   yarn
Create .env.local with variables above.

Run dev:

bash
Copy code
npm run dev
# or
yarn dev

# Sign in with Spotify to create/verify the user record.

# How logging & recommendations work (summary)
startTrackLog(sessionId, track, startPosition) creates an in-memory in-progress log.

finalizeCurrentLog(isForcedEnd, endedPosition) computes listened_duration & skipped using thresholds and attempts to enrich missing audio features.

Finalized logs are enqueued to an IndexedDB-backed queue, flushed in chunks via POST /api/track-logs/flush and upserted with idempotency keys.

/api/recommendations?mood= uses a server-side Spotify token (user token via NextAuth) to generate mood-based recommendations.

# Replay detection
Moodify uses a hybrid approach:

Client-side: detects quick restart or same-track transitions and annotates the in-progress state as a replay candidate.

Server-side: track-logs/flush reconciles chronological logs and marks authoritative replayed flags on persisted rows.

# Next steps & roadmap
Optional: add Web Playback SDK "play in browser" mode (Premium only).

Add advanced recommendation model using session embeddings (SASRec/SBERT style).

Dashboard for session analytics & mood trends.

License & credits



