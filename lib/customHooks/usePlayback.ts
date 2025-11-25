import { spotify } from "@/app/lib/spotifyClient";
import { RepeatMode } from "@/components/Player/PlayerContainer";
import { useSession, signIn } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useRef, useEffect } from "react";
import { mapToNormalizedTrack, MinimalPlayback, PlaybackTrack } from "../Playback/types";
import { RefreshResponse } from "@/app/api/auth/spotify/refresh/route";
import { playbackActions } from "@/app/store/playbackActions";
import { usePlaybackStore } from "@/app/store/usePlaybackStore";

/**
 * Custom hook to manage Spotify playback state
 * Features:
 * 1. Polls Spotify API with dynamic intervals (fast when playing, slower when paused)
 * 2. Fast sync on track changes for instant UI updates
 * 3. Smooth progress simulation every 250ms while playing
 * 4. Automatic Spotify token refresh
 * 5. Tab visibility & window focus optimization
 */


export const usePlayback = () => {
  const { data: session, status, update } = useSession();
  const queryClient = useQueryClient();

  // Playback state from zustand
  const setFromAPI = usePlaybackStore((s) => s.setFromAPI);
  const setIsPlaying = usePlaybackStore((s) => s.setIsPlaying);
  const setProgressMs = usePlaybackStore((s) => s.setProgressMs);
  const setDurationMs = usePlaybackStore((s) => s.setDurationMs);
  const setShuffle = usePlaybackStore((s) => s.setShuffle);
  const setRepeatMode = usePlaybackStore((s) => s.setRepeatMode);
  const setVolume = usePlaybackStore((s) => s.setVolume);
  const setCurrentTrack = usePlaybackStore((s) => s.setCurrentTrack);
  const isPlayingSelector = usePlaybackStore.getState;

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
        accessToken: data.accessToken,
        accessTokenExpires: data.accessTokenExpires,
        refreshToken: data.refreshToken,
      });

      return data.accessToken ?? null;
    } catch (err) {
      console.error("Failed to refresh token", err);
      signIn("spotify"); // fallback
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


      // Update local state
       const is_playing = Boolean(playback.is_playing);
      const progress_ms = playback.progress_ms ?? 0;
      const duration_ms = playback.item?.duration_ms ?? 0;
      const shuffle_state = Boolean(playback.shuffle_state);
      const repeat_state = (playback.repeat_state ?? "off") as RepeatMode;
      const deviceVolume = playback.device?.volume_percent;

        // update store atomically via setFromAPI
        setFromAPI({
          isPlaying: is_playing,
          progressMs: progress_ms,
          durationMs: duration_ms,
          shuffle: shuffle_state,
          repeatMode: repeat_state,
          volume: typeof deviceVolume === "number" ? deviceVolume : undefined,
          currentTrack: playback.item ? mapToNormalizedTrack(playback.item as PlaybackTrack) : null,
        });

      // Fast sync: detect track changes
      const currentTrackId = playback.item?.id ?? null;
      if (currentTrackId && lastTrackIdRef.current && currentTrackId !== lastTrackIdRef.current) {
        queryClient.invalidateQueries({ queryKey: ["spotifyPlayback"]}); // immediate refetch
      }
      lastTrackIdRef.current = currentTrackId;

      return playback;
    } catch (err) {
      console.error("Playback fetch error:", err);
      return null;
    }
  }, [refreshTokenIfNeeded, setCurrentTrack, setDurationMs, setFromAPI, setIsPlaying, setProgressMs, setRepeatMode, setShuffle, setVolume, queryClient]);


  /**
   * React Query to manage playback polling
   */
   useQuery({
    queryKey: ["spotifyPlayback"],
    queryFn: fetchPlayback,
    enabled: status === "authenticated",
    refetchInterval:  () =>{
      const isPlaying = usePlaybackStore.getState().isPlaying;
      return isPlaying ? 1000 : 5000;
    },
    refetchIntervalInBackground: false,    // pause when tab hidden
    refetchOnWindowFocus: true,           // sync immediately when tab visible
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
