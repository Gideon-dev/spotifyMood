// lib/Playback/loggingHelpers.ts

import type { FinalizedTrackLog, NormalizedTrack } from "@/lib/Playback/types";
import { spotify } from "@/app/lib/spotifyClient";
import { enqueueFinalizedLog } from "@/app/lib/db/tracks";

/**
 * InProgressLog kept in-memory while playback occurs
 */
export type InProgressLog = {
  idempotency_key: string;
  session_id: string;
  spotify_track_id: string;
  started_at: number;
  initial_position?: number;
  track_meta: {
    track_name?: string;
    artist?: string;
    duration?: number | null;
    album?: string | null;
    image_url?: string | null;
    preview_url?: string | null;
    // optional enrichment fields (may be undefined)
    energy?: number | undefined;
    valence?: number | undefined;
    danceability?: number | undefined;
    liked?: boolean | undefined;
  };
};

const SKIP_THRESHOLD_SECONDS = 5;
const SKIP_THRESHOLD_PERCENT = 0.15;

let currentLog: InProgressLog | null = null;

export function startTrackLog(sessionId: string, track: NormalizedTrack, startPosition = 0) {
  // defensive finalize any existing log synchronously is not desirable — callers should handle awaiting finalize if needed
  if (currentLog) {
    // best-effort: drop the older in-progress log (it should have been awaited by caller)
    currentLog = null;
  }
  const idempotency_key = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  currentLog = {
    idempotency_key,
    session_id: sessionId,
    spotify_track_id: track.spotify_track_id,
    started_at: Date.now(),
    initial_position: startPosition,
    track_meta: {
      track_name: track.track_name ?? undefined,
      artist: Array.isArray(track.artist) ? (track.artist as string[]).join(", ") : (track.artist as string | undefined),
      duration: track.duration ?? null,
      album: track.album ?? null,
      image_url: track.image_url ?? null,
      preview_url: track.preview_url ?? null,
      energy: track.energy ?? undefined,
      valence: track.valence ?? undefined,
      danceability: track.danceability ?? undefined,
      liked: track.liked ?? undefined,
    },
  };
}

/**
 * finalizeCurrentLog
 * - async: best-effort enrichment if acoustic features or liked status missing
 * - computes listened_duration, skipped, playback_position and returns FinalizedTrackLog
 * - enqueues to persistence queue (IndexedDB) via enqueueFinalizedLog
 */
export async function finalizeCurrentLog(isForcedEnd = false, endedPosition?: number): Promise<FinalizedTrackLog | null> {
  if (!currentLog) return null;

  const now = Date.now();
  const startedAt = currentLog.started_at;
  const listenedMs = (typeof endedPosition === "number" ? Math.max(0, endedPosition - (currentLog.initial_position ?? 0)) : Math.max(0, now - startedAt));
  const duration = currentLog.track_meta.duration ?? 0;
  const listenedSeconds = Math.floor(listenedMs / 1000);

  const skipped =
    listenedSeconds <= SKIP_THRESHOLD_SECONDS ||
    (duration > 0 && listenedSeconds / (duration / 1000) <= SKIP_THRESHOLD_PERCENT);

  // If enrichment fields are missing, attempt a best-effort fetch from Spotify (may fail)
  try {
    const missingFeatures = currentLog.track_meta.energy === undefined || currentLog.track_meta.valence === undefined || currentLog.track_meta.danceability === undefined;
    const missingLiked = currentLog.track_meta.liked === undefined;

    if (missingFeatures || missingLiked) {
      try {
        // attempt to fetch audio features & liked status (this uses the global spotify client)
        const [features, likedArr] = await Promise.all([
          spotify.getAudioFeaturesForTrack(currentLog.spotify_track_id).catch(() => null),
          spotify.containsMySavedTracks([currentLog.spotify_track_id]).catch(() => [false]),
        ]);

        if (features) {
          currentLog.track_meta.energy = features.energy ?? currentLog.track_meta.energy;
          currentLog.track_meta.valence = features.valence ?? currentLog.track_meta.valence;
          currentLog.track_meta.danceability = features.danceability ?? currentLog.track_meta.danceability;
          // keep duration if provided by features (some APIs return duration)
          if (features.duration_ms && !currentLog.track_meta.duration) {
            currentLog.track_meta.duration = features.duration_ms;
          }
        }

        if (Array.isArray(likedArr)) {
          currentLog.track_meta.liked = !!likedArr[0];
        }
      } catch (err) {
        // ignore enrichment errors — we can still log without these fields
        console.warn("finalizeCurrentLog: enrichment failed", err);
      }
    }
  } catch (err) {
    console.warn("finalizeCurrentLog enrichment outer catch", err);
  }

  const payload: FinalizedTrackLog = {
    idempotency_key: currentLog.idempotency_key,
    session_id: currentLog.session_id,
    spotify_track_id: currentLog.spotify_track_id,
    track_name: currentLog.track_meta.track_name ?? undefined,
    artist: currentLog.track_meta.artist ?? undefined,
    duration: typeof currentLog.track_meta.duration === "number" ? currentLog.track_meta.duration : undefined,
    listened_at: new Date(startedAt).toISOString(),
    listened_duration: Math.max(0, Math.round(listenedMs)),
    skipped,
    playback_position: typeof endedPosition === "number" ? endedPosition : null,
    album: currentLog.track_meta.album ?? undefined,
    image_url: currentLog.track_meta.image_url ?? undefined,
    preview_url: currentLog.track_meta.preview_url ?? undefined,
    energy: currentLog.track_meta.energy ?? undefined,
    valence: currentLog.track_meta.valence ?? undefined,
    danceability: currentLog.track_meta.danceability ?? undefined,
    liked: currentLog.track_meta.liked ?? undefined,
  };

  try {
    // enqueue for persistence (IndexedDB queue)
    await enqueueFinalizedLog(payload);
  } catch (err) {
    // enqueue best-effort: if it fails, continue (client will keep in-memory payload lost unless persisted)
    console.warn("finalizeCurrentLog: enqueue failed", err);
  } finally {
    clearInProgress()
  }
  return payload;
}

export function clearInProgress() {
  currentLog = null;
}
