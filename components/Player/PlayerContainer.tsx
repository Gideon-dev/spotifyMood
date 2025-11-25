"use client";
/*
  Production-ready PlayerContainer
  - Single source of truth: usePlaybackStore (Zustand)
  - UI is optimistic: store updates immediately, service calls run async
  - Progress ticker is store-managed; component only starts/stops it via store actions
  - All Spotify side-effects are delegated to playbackService where appropriate
  - Clear separation: UI -> store actions -> playbackService / DB queue
*/

import React, { useEffect, useState, useCallback } from "react";
import { usePlaybackStore } from "@/app/store/usePlaybackStore";
import {
  pausePlayback,
  resumePlayback,
  skipToNext as spotifySkipNext,
  skipToPrevious as spotifySkipPrev,
  seek as spotifySeek,
  setVolume as spotifySetVolume,
  setShuffle as spotifySetShuffle,
  setRepeat as spotifySetRepeat,
  toggleLike as spotifyToggleLike,
} from "@/lib/Playback/playbackService";
import { PlayerCenter, PlayerLeft, PlayerRight } from "./PlayerUtilities";

export type RepeatMode = "off" | "context" | "track";

const PlayerContainer: React.FC = () => {
  // Selectors / actions from the store (keeps component tiny)
  const currentTrack = usePlaybackStore((s) => s.currentTrack);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const liked = usePlaybackStore((s) => s.liked);
  const progressMs = usePlaybackStore((s) => s.progressMs);
  const durationMs = usePlaybackStore((s) => s.durationMs);
  const volume = usePlaybackStore((s) => s.volume);
  const shuffle = usePlaybackStore((s) => s.shuffle);
  const repeatMode = usePlaybackStore((s) => s.repeatMode);

  const playTrack = usePlaybackStore((s) => s.playTrack);
  const togglePlay = usePlaybackStore((s) => s.togglePlay);
  const nextTrack = usePlaybackStore((s) => s.nextTrack);
  const previousTrack = usePlaybackStore((s) => s.previousTrack);
  const setShuffle = usePlaybackStore((s) => s.setShuffle);
  const setRepeatMode = usePlaybackStore((s) => s.setRepeatMode);
  const setVolume = usePlaybackStore((s) => s.setVolume);
  const startProgressTicker = usePlaybackStore((s) => s.startProgressTicker);
  const stopProgressTicker = usePlaybackStore((s) => s.stopProgressTicker);
  const storeToggleLike = usePlaybackStore((s) => s.toggleLike);

  // Keep ticker lifecycle in sync with playing state.
  // We call start/stop on mount/update and also cleanup on unmount.
  useEffect(() => {
    if (isPlaying) startProgressTicker(250);
    else stopProgressTicker();

    return () => {
      stopProgressTicker();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  /* ------------------------------
     Handlers (UI -> optimistic store -> side-effect)
     ------------------------------ */



  // Skip next — optimistic: use store's queue logic if present
  const onSkipNext = useCallback(async () => {
    // update store (will call playTrack for next track)
    await nextTrack();
    try {
      await spotifySkipNext();
    } catch (err) {
      // non-fatal: store will reconcile with polling
      console.warn("spotify skip next failed", err);
    }
  }, [nextTrack]);

  // Skip previous
  const onSkipPrev = useCallback(async () => {
    await previousTrack();
    try {
      await spotifySkipPrev();
    } catch (err) {
      console.warn("spotify skip previous failed", err);
    }
  }, [previousTrack]);

  // Like / Unlike — optimistic update in store and call Spotify
  const onToggleLike = useCallback(async () => {
    if (!currentTrack) return;
    // storeToggleLike should optimistically flip liked state
    await storeToggleLike();
    try {
      // call spotify to persist
      await spotifyToggleLike(currentTrack.spotify_track_id, liked);
    } catch (err) {
      console.warn("spotify toggleLike failed", err);
      // Optionally: revert store state here if desired
    }
  }, [currentTrack, liked, storeToggleLike]);

  // Seek (from progress bar) — optimistic update then call Spotify
  const onSeek = useCallback(
    async (ms: number) => {
      if (!currentTrack) return;
      // optimistic update: update store elapsed/progress
      usePlaybackStore.getState().setProgressMs(ms);
      try {
        await spotifySeek(ms);
      } catch (err) {
        console.warn("spotify seek failed", err);
      }
    },
    [currentTrack]
  );

  // Volume change — optimistic store update and call Spotify
  const onVolumeChange = useCallback(
    async (v: number) => {
      const clamped = Math.max(0, Math.min(100, Math.round(v)));
      setVolume(clamped); // store update
      try {
        await spotifySetVolume(clamped);
      } catch (err) {
        console.warn("spotify setVolume failed", err);
      }
    },
    [setVolume]
  );

  // Shuffle toggle
  const onSetShuffle = useCallback(
    async (s: boolean) => {
      setShuffle(s); // optimistic
      try {
        await spotifySetShuffle(s);
      } catch (err) {
        console.warn("spotify setShuffle failed", err);
      }
    },
    [setShuffle]
  );

  // Cycle repeat mode
  const onCycleRepeat = useCallback(() => {
    const order: RepeatMode[] = ["off", "context", "track"];
    const next = order[(order.indexOf(repeatMode) + 1) % order.length];
    setRepeatMode(next);
    // best-effort Spotify call (no await)
    spotifySetRepeat(next).catch((e) => console.warn("spotify setRepeat failed", e));
  }, [repeatMode, setRepeatMode]);

  /* ------------------------------
     Render
     ------------------------------ */
  return (
    <div className="w-full h-auto bg-[#181818] border-t border-[#282828] px-4 flex items-center justify-between text-white flex-wrap">
      <PlayerLeft track={currentTrack} liked={liked} onLike={onToggleLike} />

      <div className="flex-1 mx-4">
        <PlayerCenter
          progressMs={progressMs}
          durationMs={durationMs}
          onSeek={(ms: number) => onSeek(ms)}
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          onSkipNext={onSkipNext}
          shuffle={shuffle}
          setShuffle={(s: boolean) => onSetShuffle(s)}
          repeatMode={repeatMode}
          cycleRepeat={onCycleRepeat}
        />
      </div>

      <PlayerRight
        volume={volume}
        setVolume={(v: number) => onVolumeChange(v)}
        onOpenDevices={() => {
          // Optionally open your device picker modal — not implemented here
        }}
      />
    </div>
  );
};

export default PlayerContainer;
