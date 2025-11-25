// lib/Playback/handlePlay.ts

import { mapToSupabaseInsert, NormalizedTrack } from "./types"
import { flushTrackLogs, queueTrackLog } from "@/app/lib/db/tracks"
import { spotify } from "@/app/lib/spotifyClient"
import { playbackActions } from "@/app/store/playbackActions"




export async function handlePlay(track: NormalizedTrack) {
  const { sessionId } = playbackActions.state
  if (!track?.uri) return console.warn("⚠️ Tried to play invalid track", track)

  try {
    // 1️⃣ Play track on Spotify
    await spotify.play({ uris: [track.uri] })
    playbackActions.set({ isPlaying: true, currentTrack: track })

    // 2️⃣ Fetch liked status + audio features
    const [likedResponse, features] = await Promise.all([
      spotify.containsMySavedTracks([track.spotify_track_id]),
      spotify.getAudioFeaturesForTrack(track.spotify_track_id),
    ])

    const isLiked = Array.isArray(likedResponse) ? likedResponse[0] : false
    const { energy, valence, danceability } = features ?? {}

    // 3️⃣ Queue track log for Supabase (batched)
    if (sessionId) {
      const toInsert = mapToSupabaseInsert({
        ...track,
        session_id: sessionId,
        energy,
        valence,
        danceability,
        liked: isLiked
      });
      queueTrackLog(toInsert)
      flushTrackLogs()
    }

    // 4️⃣ Update store liked state
    playbackActions.set({ liked: isLiked })

    console.log(`🎵 Playing ${track.track_name} (${track.artist})`)
  } catch (err) {
    console.error("❌ handlePlay error:", err)
    // playbackActions.set({ isPlaying: falseNOTE})
  }
}

export async function pausePlayback() {
  await spotify.pause();
  playbackActions.set({ isPlaying: false });
  // stopProgressTicker();
}

export async function resumePlayback() {
  await spotify.play();
  playbackActions.set({ isPlaying: true });
  // startProgressTicker();
}



export async function skipToNext() {await spotify.skipToNext()}
export async function skipToPrevious() { await spotify.skipToPrevious(); }
export async function seek(ms: number) {
  await spotify.seek(ms);
  playbackActions.set({ elapsed: ms });
}

export async function setVolume(v: number) {
  const vol = Math.max(0, Math.min(100, Math.round(v)));
  await spotify.setVolume(vol);
  playbackActions.set({ volume: vol });
}

export async function setRepeat(mode: "off" | "context" | "track") {
  await spotify.setRepeat(mode);
  playbackActions.set({ repeatMode: mode });
}
export async function setShuffle(s: boolean) {
  await spotify.setShuffle(s);
  playbackActions.set({ shuffle: s });
}
export async function transferPlayback(deviceId: string, play = true) {
  await spotify.transferMyPlayback([deviceId], { play });
}

export async function toggleLike(trackId: string, liked: boolean) {
  if (liked) await spotify.removeFromMySavedTracks([trackId]);
  else await spotify.addToMySavedTracks([trackId]);
  playbackActions.set({ liked: !liked });
}


