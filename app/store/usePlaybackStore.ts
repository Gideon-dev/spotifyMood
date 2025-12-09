"use client"
// stores/usePlaybackStore.ts
import { create } from "zustand"
import { persist, subscribeWithSelector } from "zustand/middleware"
import { NormalizedTrack, SpotifyRecommendationTrack } from "@/lib/Playback/types"
import { flushTrackLogs } from "../lib/db/tracks"
import { handlePlay, pausePlayback, resumePlayback, seek, setRepeat, setShuffle, setVolume, toggleLike } from "@/lib/Playback/playbackService"
import { RepeatMode } from "@/components/Player/PlayerContainer"
import { finalizeCurrentLog } from "@/lib/Playback/loggingHelpers"

export type PlaybackState = {
  sessionId?: string
  isPlaying: boolean
  currentTrack: NormalizedTrack | null
  liked: boolean
  elapsed: number
  timer?: ReturnType<typeof setInterval>
  moodMeta?: {
    moodType?: string
    energyLevel?: number
  
  }
  progressMs: number;
  durationMs: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
  volume: number;
  queue: NormalizedTrack[];
  currentIndex: number;


  cachedRecommendations: Record<string, NormalizedTrack[]>;
  loadingRecommendations: boolean;

  //internal function
  _progressTicker?: number | null;

  setFromAPI: (payload: Partial<{
    isPlaying: boolean;
    progressMs: number;
    durationMs: number;
    shuffle: boolean;
    repeatMode: RepeatMode;
    volume: number;
    currentTrack: NormalizedTrack | null;
  }>) => void;


  // --- session Actions ---
  restoreSession: () => Promise<void>
  startSession: (mood: string, content: Record<string, string|number>) => Promise<void>
  endSession: () => Promise<void>

  //playback actions
  setIsPlaying: (v: boolean) => void
  setCurrentTrack: (t: NormalizedTrack | null) => void
  startProgressTicker: (tickMs?: number) => void;
  stopProgressTicker: () => void;
  setQueue: (tracks: NormalizedTrack[], startIndex?: number) =>  Promise<void>;
  
  //music interactions
  playTrack: (track: NormalizedTrack | number) => Promise<void>
  togglePlay: () => Promise<void>
  toggleLike: () => Promise<void>
  setProgressMs: (ms: number) => void;
  setDurationMs: (ms: number) => void;
  seekTo: (ms: number) => void;
  setShuffle: (s: boolean) => Promise<void>;
  setRepeatMode: (r: RepeatMode) => Promise<void>;
  setVolume: (v: number) => Promise<void>;
  playMoodTrack: (mood: string) => Promise<void>;
  nextTrack: () => Promise<void>
  previousTrack: () => Promise<void>
  


}

export const usePlaybackStore = create<PlaybackState>()(
  subscribeWithSelector(
    persist(
      (set, get) => {
            
          return {
              sessionId: undefined,
              isPlaying: false,
              progressMs: 0,
              durationMs: 0,
              shuffle: false,
              repeatMode: "off",
              volume: 50,
              _progressTicker: null,
              currentTrack: null,
              liked: false,
              elapsed: 0,
              timer: undefined,
              moodMeta: {},
              queue: [],
              currentIndex: 0,
              cachedRecommendations: {},
              loadingRecommendations: false,

              setIsPlaying: (v) => {
                set({ isPlaying: v });
              },

              restoreSession: async () => {
                try {
                  const res = await fetch("/api/mood-session/active", {
                    method: "GET",
                    cache: "no-store",
                  });
      
                  const data = await res.json();
                  const session = data.session;
      
                  if (!session) {
                    set({ sessionId: undefined, moodMeta: {}, elapsed: 0 });
                    return;
                  }
      
                  set({
                    sessionId: session.id,
                    moodMeta: { moodType: session.mood },
                    elapsed: session.started_at
                    ? Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000)
                    : 0
                  });
      
                  console.log("🔄 Restored active session:", session.id);
                } catch (err) {
                  console.error("Failed to restore session", err);
                }
              },
        
              startSession: async ( spotifyMood,context={}) => {
                  // Clear any existing ticker before starting a new session
                try {
                  get().stopProgressTicker?.();
                } catch (e) {
                  // defensive: ignore if not present
                  console.warn(e)
                }
                
                const res = await fetch("/api/mood-session/create", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ mood:spotifyMood, context }),
                });
      
                const data = await res.json();
      
                if (!data.session) {
                  console.error("Could not create session:", data.error);
                  return;
                }
      
                const newSession = data.session;
      
                set({
                  sessionId: newSession.id,
                  queue: [],
                  currentIndex: 0,
                  currentTrack: null,
                  progressMs: 0,
                  durationMs: 0,
                  moodMeta: { moodType: newSession.mood },
                });
      
                console.log("🆕 Mood session started:", newSession.id);
              },
        
              endSession: async () => {
                const { sessionId, timer } = get();
                if (timer) clearInterval(timer);
                if (!sessionId) return;
              
                // finalize any in-progress log before ending the session
                try {
                  await finalizeCurrentLog(true);
                } catch (err) {
                  console.warn("endSession finalize failed", err);
                }
              
                try {
                  const res = await fetch("/api/mood-session/end", { method: "POST" });
                  const data = await res.json();
                  // flush logs (fire-and-forget)
                  flushTrackLogs().catch(() => {});
                  set({
                    sessionId: undefined,
                    currentTrack: null,
                    isPlaying: false,
                    elapsed: 0,
                    progressMs: 0,
                    durationMs: 0,
                    shuffle: false,
                    repeatMode: "off",
                    volume: 50,
                  });
                  console.log(`✅ Session ended ${data.session?.id}, & logs flushed`);
                } catch (err) {
                  console.log("✅ Session ended & logs flushed (local fallback)", err);
                }
              },

              // playTrack by index or by track object
              playTrack: async (indexOrTrack) => {
                const state = get();
                let index = 0;
                if (typeof indexOrTrack === "number") {
                  index = indexOrTrack;
                } else {
                  // find index in queue or prepend track
                  const idx = state.queue.findIndex((t) => t.spotify_track_id === indexOrTrack.spotify_track_id);
                  if (idx >= 0) index = idx;
                  else {
                    // prepend to queue
                    const newQueue = [indexOrTrack, ...state.queue];
                    set({ queue: newQueue, currentIndex: 0, currentTrack: indexOrTrack, progressMs: 0, durationMs: indexOrTrack.duration ?? 0 });
                    index = 0;
                  }
                }

                const track = get().queue[index];
                if (!track) {
                  console.warn("playTrack: no track found at index", index);
                  return;
                }

                 // finalize any previous in-progress log before switching
                try {
                  await finalizeCurrentLog(true);
                } catch (err) {
                  console.warn("playTrack finalizeCurrentLog failed", err);
                }

                // optimistic UI: set current track and playing state
                set({ currentIndex: index, currentTrack: track, isPlaying: true, progressMs: 0, durationMs: track.duration ?? 0 });

                // call Spotify API to play -- prefer using playbackService
                await handlePlay(track)
                get().startProgressTicker()
              },

              playMoodTrack: async (mood) => {
                const state = get();
                // Guard: require sessionId (defensive)
                if (!state.sessionId) {
                  throw new Error("No active session. Call startSession() first.");
                }
                
                // Check cache
                if (state.cachedRecommendations[mood]?.length) {
                  console.log(`🎵 Using cached tracks for mood: ${mood}`);
                  // pick first track as current
                  const track = state.cachedRecommendations[mood][0];
                  await handlePlay(track);
                  set({ currentTrack: track, isPlaying: true });
                  return;
                }

                try {
                  set({ loadingRecommendations: true });
                  const res = await fetch(`/api/recommendations?mood=${mood}`);
                  const data = await res.json();
              
                  if (!data.tracks) return;
              
                  const normalizedTracks: NormalizedTrack[] = data.tracks.map((t: SpotifyRecommendationTrack) => ({
                    spotify_track_id: t.id,
                    title: t.name,
                    artist: t.artists.map((a) => a.name),
                    duration: t.duration_ms,
                  }));

                  
                  // cache
                  set((s) => ({ cachedRecommendations: { ...s.cachedRecommendations, [mood]: normalizedTracks } }));


                   // set queue and auto play first
                  await get().setQueue(normalizedTracks, 0);
                  if (normalizedTracks.length) await get().playTrack(0);
                  handlePlay(normalizedTracks[0]);

                } catch (err) {
                  console.error("Failed to fetch mood recommendations", err);
                } finally {
                  set({ loadingRecommendations: false });
                }
              },

              togglePlay: async () => {
                const { isPlaying, currentTrack,startProgressTicker,stopProgressTicker } = get();

                if (!currentTrack) return
                if (isPlaying){
                  await pausePlayback();
                  startProgressTicker()
                }
                else {
                  await resumePlayback();
                  stopProgressTicker()
                }
                // set({ isPlaying: !isPlaying })
              },

              nextTrack: async () => {
                const { currentIndex, queue } = get();
                if (queue.length === 0) return;
                const nextIndex = (currentIndex + 1) % queue.length;
                const track = queue[nextIndex];

                // finalize current log before switching
                try {
                  await finalizeCurrentLog(true);
                } catch (err) {
                  console.warn("nextTrack finalize failed", err);
                }

                set({ currentIndex: nextIndex, currentTrack: track });
                await get().playTrack(track);
              },
        
              previousTrack: async () => {
                const { currentIndex, queue } = get();
                if (queue.length === 0) return;
                const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
                const track = queue[prevIndex];

                try {
                  await finalizeCurrentLog(true);
                } catch (err) {
                  console.warn("previousTrack finalize failed", err);
                }

                set({ currentIndex: prevIndex, currentTrack: track });
                await get().playTrack(track);
              },

              toggleLike: async () => {
                const { currentTrack, liked } = get()
                if (!currentTrack) return
                await toggleLike(currentTrack.spotify_track_id, liked)
                set({ liked: !liked })
              },

              setProgressMs: (ms) => set({ progressMs: ms }),
              setDurationMs: (ms) => set({ durationMs: ms }),
              setShuffle: async (s) => {
                await setShuffle(s)
                set({ shuffle: s })
              },
              seekTo: async (ms) => {
                await seek(ms)
                set({ progressMs: ms })
              },
              setRepeatMode: async (mode) => {
                await setRepeat(mode)
                set({ repeatMode: mode })
              },
              setVolume: async (v) => {
                await setVolume(v)
                set({ volume: v })
              },
              setCurrentTrack: (t) => set({ currentTrack: t }),

              startProgressTicker: (tickMs = 250) => {
                const state = get();
                if (state._progressTicker) {
                  window.clearInterval(state._progressTicker);
                }
                const id = window.setInterval(() => {
                  const s = get();
                  // increment by tickMs, clamp to durationMs
                  const next = Math.min((s.progressMs || 0) + tickMs, s.durationMs || Infinity);
                  set({ progressMs: next });
                }, tickMs) as unknown as number;
                set({ _progressTicker: id });
              },

              stopProgressTicker: () => {
                const { _progressTicker } = get();
                if (_progressTicker) {
                  window.clearInterval(_progressTicker);
                }
                set({ _progressTicker: null });
              },

              setFromAPI: (payload) => {
                set((s) => {
                  const next = {
                    ...s,
                    ...(payload.isPlaying !== undefined ? { isPlaying: payload.isPlaying } : {}),
                    ...(payload.progressMs !== undefined ? { progressMs: payload.progressMs } : {}),
                    ...(payload.durationMs !== undefined ? { durationMs: payload.durationMs } : {}),
                    ...(payload.shuffle !== undefined ? { shuffle: payload.shuffle } : {}),
                    ...(payload.repeatMode !== undefined ? { repeatMode: payload.repeatMode } : {}),
                    ...(payload.volume !== undefined ? { volume: payload.volume } : {}),
                    ...(payload.currentTrack !== undefined ? { currentTrack: payload.currentTrack } : {}),
                  };
                  return next;
                });
              },
              setQueue: async (tracks, startIndex = 0) => {
                set({
                  queue: tracks,
                  currentIndex: startIndex,
                  currentTrack: tracks[startIndex] ?? null,
                  progressMs: 0,
                  durationMs: tracks[startIndex]?.duration ?? 0,
                });
              },
          }
      },
      { name: "playback-storage" } // persist local playback state
    )
  )
)
