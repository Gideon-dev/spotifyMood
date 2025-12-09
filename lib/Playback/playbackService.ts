// lib/Playback/handlePlay.ts
import { spotify } from "@/app/lib/spotifyClient";
import { playbackActions } from "@/app/store/playbackActions";
import { startTrackLog } from "@/lib/Playback/loggingHelpers";
import type { NormalizedTrack } from "@/lib/Playback/types";

/**
 * Enriched playback handler (Version B)
 *
 * Responsibilities:
 *  - Send play command to Spotify
 *  - Update local playback state (Zustand)
 *  - Fetch enrichment (liked + audio features + optional playback progress)
 *  - Mutate/enrich the given `track` object with features & liked flag
 *  - Start an in-progress analytics log via startTrackLog(sessionId, enrichedTrack, startPosition)
 *
 * Important: This function does NOT finalize or enqueue finalized logs. Finalization
 * happens in the playback polling / user-action pipeline (finalizeCurrentLog).
 */

export async function handlePlay(track: NormalizedTrack) {
  const { sessionId } = playbackActions.state;

  if (!track || !track.uri || !track.spotify_track_id) {
    console.warn("handlePlay: invalid track", track);
    return;
  }

  try {
    // 1) Send play command to Spotify
    // prefer passing URIs; if URI not available fallback to context/uris
    await spotify.play({ uris: [track.uri] });

    // optimistically update local UI state
    playbackActions.set({ isPlaying: true, currentTrack: track });

    // 2) Enrich: in parallel fetch liked status, audio features, and current playback state
    // (current playback state helps us get progress_ms to start the in-progress log at accurate position)
    const [likedResponse, features, playbackState] = await Promise.all([
      // containsMySavedTracks returns array of booleans
      spotify.containsMySavedTracks([track.spotify_track_id]).catch((e: unknown) => {
        console.warn("containsMySavedTracks failed", e);
        return [false];
      }),
      spotify.getAudioFeaturesForTrack(track.spotify_track_id).catch((e: unknown) => {
        console.warn("getAudioFeaturesForTrack failed", e);
        return null;
      }),
      spotify.getMyCurrentPlaybackState().catch((e: unknown) => {
        console.warn("getMyCurrentPlaybackState failed", e);
        return null;
      }),
    ]);

    const isLiked = Array.isArray(likedResponse) ? !!likedResponse[0] : false;
    const energy: number = features?.energy ?? undefined;
    const valence:number = features?.valence ?? undefined;
    const danceability:number = features?.danceability ?? undefined;

    // 3) Mutate/enrich the track object in-place (strategy A)
    // Add enrichment fields to the track (safe mutation)
    track.energy = energy;
    track.valence = valence;
    track.danceability = danceability;
    track.liked = isLiked;

    // 4) Update store with enriched liked state (and currentTrack again so UI sees enriched data)
    playbackActions.set({ liked: isLiked, currentTrack: track });

    // 5) Start analytics in-progress log if there is an active session
    // Determine start position (progress_ms from playback state if available)
    const startPosition:number = playbackState?.progress_ms ?? 0;

    if (sessionId) {
      try {
        startTrackLog(sessionId, track, startPosition);
      } catch (err) {
        console.warn("startTrackLog failed", err);
      }
    } else {
      // no session; skip analytics log start but UI still updated
      console.debug("handlePlay: no active sessionId, skipping startTrackLog");
    }

    console.log(`🎵 Playing ${track.track_name ?? track.spotify_track_id} — enriched (liked=${isLiked})`);
  } catch (err) {
    console.error("handlePlay error:", err);
    // Try to keep local state sane
    playbackActions.set({ isPlaying: false });
  }
}

/* lightweight wrappers for other controls — unchanged semantics, kept here for convenience */

export async function pausePlayback() {
  try {
    await spotify.pause();
  } catch (err) {
    console.warn("pausePlayback spotify.pause failed", err);
  } finally {
    playbackActions.set({ isPlaying: false });
  }
}

export async function resumePlayback() {
  try {
    await spotify.play();
    playbackActions.set({ isPlaying: true });
  } catch (err) {
    console.warn("resumePlayback spotify.play failed", err);
  }
}

export async function skipToNext() {
  try {
    await spotify.skipToNext();
  } catch (err) {
    console.warn("skipToNext failed", err);
  }
}

export async function skipToPrevious() {
  try {
    await spotify.skipToPrevious();
  } catch (err) {
    console.warn("skipToPrevious failed", err);
  }
}

export async function seek(ms: number) {
  try {
    await spotify.seek(ms);
    playbackActions.set({ elapsed: ms });
  } catch (err) {
    console.warn("seek failed", err);
  }
}

export async function setVolume(v: number) {
  const vol = Math.max(0, Math.min(100, Math.round(v)));
  try {
    await spotify.setVolume(vol);
    playbackActions.set({ volume: vol });
  } catch (err) {
    console.warn("setVolume failed", err);
  }
}

export async function setRepeat(mode: "off" | "context" | "track") {
  try {
    await spotify.setRepeat(mode);
    playbackActions.set({ repeatMode: mode });
  } catch (err) {
    console.warn("setRepeat failed", err);
  }
}

export async function setShuffle(s: boolean) {
  try {
    await spotify.setShuffle(s);
    playbackActions.set({ shuffle: s });
  } catch (err) {
    console.warn("setShuffle failed", err);
  }
}

export async function transferPlayback(deviceId: string, play = true) {
  try {
    await spotify.transferMyPlayback([deviceId], { play });
  } catch (err) {
    console.warn("transferPlayback failed", err);
  }
}

export async function toggleLike(trackId: string, liked: boolean) {
  try {
    if (liked) await spotify.removeFromMySavedTracks([trackId]);
    else await spotify.addToMySavedTracks([trackId]);
    playbackActions.set({ liked: !liked });
  } catch (err) {
    console.warn("toggleLike failed", err);
  }
}
