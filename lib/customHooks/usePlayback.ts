// app/lib/Playback/usePlayback.ts
import { spotify } from "@/app/lib/spotifyClient";
import { RepeatMode } from "@/components/Player/PlayerContainer";
import { useSession, signIn } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useEffect } from "react";
import { mapToNormalizedTrack, MinimalPlayback, PlaybackTrack } from "@/lib/Playback/types";
import { RefreshResponse } from "@/app/api/auth/spotify/refresh/route";
import { usePlaybackStore } from "@/app/store/usePlaybackStore";
import { startTrackLog, finalizeCurrentLog } from "@/lib/Playback/loggingHelpers";

/**
 * Custom hook to manage Spotify playback state
 * - Polls /me/player
 * - On track-change: hybrid flow:
 *    1) finalize previous in-progress log (await finalizeCurrentLog)
 *    2) enrich new track (best-effort) and startTrackLog()
 */

export const usePlayback = () => {
  const { data: session, status, update } = useSession();
  const queryClient = useQueryClient();

  // Playback state from zustand
  const setFromAPI = usePlaybackStore((s) => s.setFromAPI);
  const setIsPlaying = usePlaybackStore((s) => s.setIsPlaying);

  // Refs for tracking last track and smooth progress interval
  const lastTrackIdRef = useRef<string | null>(null);

  /**
   * Refresh Spotify token if needed
   */
  const refreshTokenIfNeeded = useCallback(async (): Promise<string | null> => {
    if (!session) return null;
    try {
      const res = await fetch("/api/auth/spotify/refresh", { method: "POST" });
      if (!res.ok) throw new Error("Failed to refresh token");
      const data: RefreshResponse = await res.json();

      // Update NextAuth session with new token
      await update({
        accessTokenExpires: data.accessTokenExpires,
        refreshToken: data.refreshToken,
      });

      // set token to client
      spotify.setAccessToken(data.accessToken ?? "");
      return data.accessToken ?? null;
    } catch (err) {
      console.error("Failed to refresh token", err);
      // optionally signIn to recover
      try { signIn("spotify"); } catch {}
      return null;
    }
  }, [session, update]);

  /**
   * Fetch current playback state from Spotify
   */
  const fetchPlayback = useCallback(async (): Promise<MinimalPlayback | null> => {
    const token = await refreshTokenIfNeeded();
    if (!token) return null;

    spotify.setAccessToken(token);

    try {
      const playback: MinimalPlayback = await spotify.getMyCurrentPlaybackState();

      if (!playback) {
        // no active player
        setIsPlaying(false);
        return null;
      }

      // Map values for store
      const is_playing = Boolean(playback.is_playing);
      const progress_ms = playback.progress_ms ?? 0;
      const duration_ms = playback.item?.duration_ms ?? 0;
      const shuffle_state = Boolean(playback.shuffle_state);
      const repeat_state = (playback.repeat_state ?? "off") as RepeatMode;
      const deviceVolume = playback.device?.volume_percent;

      // prepare normalized track
      const normalized = playback.item ? mapToNormalizedTrack(playback.item as PlaybackTrack) : null;

      // Fast sync: detect track changes
      const currentTrackId = playback.item?.id ?? null;

      // If a track changed (lastTrack exists and differs), do hybrid reconciliation:
      if (currentTrackId && lastTrackIdRef.current && currentTrackId !== lastTrackIdRef.current) {
        // 1) finalize old in-progress log (best-effort)
        try {
          await finalizeCurrentLog(true);
        } catch (err) {
          console.warn("usePlayback.finalizeCurrentLog failed", err);
        }

        // 2) enrich the new track (best-effort): fetch audio features & liked
        try {
          const [features, likedArr] = await Promise.all([
            spotify.getAudioFeaturesForTrack(currentTrackId).catch(() => null),
            spotify.containsMySavedTracks([currentTrackId]).catch(() => [false]),
          ]);

          if (normalized) {
            if (features) {
              normalized.energy = features.energy ?? undefined;
              normalized.valence = features.valence ?? undefined;
              normalized.danceability = features.danceability ?? undefined;
              // features may include duration_ms
              normalized.duration = normalized.duration ?? features?.duration_ms ?? normalized.duration;
            }
            if (Array.isArray(likedArr)) {
              normalized.liked = !!likedArr[0];
            }
          }
        } catch (err) {
          console.warn("usePlayback enrichment failed", err);
        }

        // 3) start new in-progress log if session exists
        const sessionId = usePlaybackStore.getState().sessionId;
        if (sessionId && normalized) {
          try {
            startTrackLog(sessionId, normalized, progress_ms ?? 0);
          } catch (err) {
            console.warn("usePlayback.startTrackLog failed", err);
          }
        }

        // prompt immediate refetch for UI consistency if desired
        queryClient.invalidateQueries({ queryKey: ["spotifyPlayback"] });
      }

      // If there was no previous track and now there is one, start log
      if (!lastTrackIdRef.current && currentTrackId) {
        // same enrichment attempt as above
        try {
          const [features, likedArr] = await Promise.all([
            spotify.getAudioFeaturesForTrack(currentTrackId).catch(() => null),
            spotify.containsMySavedTracks([currentTrackId]).catch(() => [false]),
          ]);

          if (normalized) {
            if (features) {
              normalized.energy = features.energy ?? undefined;
              normalized.valence = features.valence ?? undefined;
              normalized.danceability = features.danceability ?? undefined;
              normalized.duration = normalized.duration ?? features?.duration_ms ?? normalized.duration;
            }
            if (Array.isArray(likedArr)) {
              normalized.liked = !!likedArr[0];
            }
          }
        } catch (err) {
          console.warn("usePlayback initial enrichment failed", err);
        }

        const sessionId = usePlaybackStore.getState().sessionId;
        if (sessionId && normalized) {
          try {
            startTrackLog(sessionId, normalized, progress_ms ?? 0);
          } catch (err) {
            console.warn("startTrackLog initial failed", err);
          }
        }
      }

      // Update local store atomically via setFromAPI
      setFromAPI({
        isPlaying: is_playing,
        progressMs: progress_ms,
        durationMs: duration_ms,
        shuffle: shuffle_state,
        repeatMode: repeat_state,
        volume: typeof deviceVolume === "number" ? deviceVolume : undefined,
        currentTrack: normalized,
      });

      lastTrackIdRef.current = currentTrackId;
      return playback;
    } catch (err) {
      console.error("Playback fetch error:", err);
      return null;
    }
  }, [queryClient, refreshTokenIfNeeded, setFromAPI, setIsPlaying]);

  /**
   * React Query to manage playback polling
   */
  useQuery({
    queryKey: ["spotifyPlayback"],
    queryFn: fetchPlayback,
    enabled: status === "authenticated",
    refetchInterval: () => {
      const isPlaying = usePlaybackStore.getState().isPlaying;
      return isPlaying ? 1000 : 5000;
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  /**
   * Smooth progress simulation
   */
  useEffect(() => {
    const unsub = usePlaybackStore.subscribe((s) => s.isPlaying, (playing) => {
      if (playing) {
        usePlaybackStore.getState().startProgressTicker(250);
      } else {
        usePlaybackStore.getState().stopProgressTicker();
      }
    });

    // run once with current value
    if (usePlaybackStore.getState().isPlaying) {
      usePlaybackStore.getState().startProgressTicker(250);
    }

    return () => {
      const s = usePlaybackStore.getState();
      if (s._progressTicker) {
        window.clearInterval(s._progressTicker);
        s._progressTicker = null;
      }
      unsub();
    };
  }, []);
};
