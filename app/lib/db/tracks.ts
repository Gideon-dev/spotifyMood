// lib/db/tracks.ts
import { supabase } from "../supabaseClient"; // adjust path if needed
import type { MoodSessionTrackType } from "@/lib/Playback/types";

/**
 * Tracks queue: in-memory +/- persisted to localStorage for resilience.
 * This module coordinates across tabs using BroadcastChannel.
 *
 * Guarantees / behavior:
 * - queueTrackLog() adds to the local queue, persists to localStorage, and broadcasts to other tabs.
 * - flushTrackLogs() attempts to insert queued logs into Supabase, with retry/backoff on failure.
 * - On beforeunload, we attempt a final flush.
 * - On tab start, we load any persisted queue from localStorage and merge with in-memory queue.
 * - BroadcastChannel keeps all open tabs reasonably in sync (realtime), so multiple tabs won't each re-send the same logs.
 */

/* =========================
   Config / Tunables
   ========================= */
const LS_KEY = "mood_track_queue_v1";
const BC_CHANNEL = "mood-track-queue-v1";

// Base flush interval (ms). Dynamic adjustments are applied.
const BASE_FLUSH_INTERVAL = 5000; // 5s
const FAST_FLUSH_INTERVAL = 2000; // 2s when queue is large
const QUEUE_FAST_THRESHOLD = 10; // queue length beyond which we flush faster

// Backoff config on failure
const BACKOFF_BASE = 2000; // initial backoff on failure (ms)
const BACKOFF_MAX = 60_000; // maximum backoff (ms)

/* =========================
   Internal state
   ========================= */
let trackQueue: MoodSessionTrackType[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
let flushIntervalMs = BASE_FLUSH_INTERVAL;
let backoffMs = BACKOFF_BASE;
let isFlushing = false;

// BroadcastChannel for cross-tab sync (if supported)
const bc: BroadcastChannel | null = typeof window !== "undefined" && "BroadcastChannel" in window
  ? new BroadcastChannel(BC_CHANNEL)
  : null;

/* =========================
   Utils: persistence & dedupe
   ========================= */
function saveQueueToStorage() {
  try {
    if (typeof window === "undefined") return;
    if (trackQueue.length === 0) {
      localStorage.removeItem(LS_KEY);
      return;
    }
    localStorage.setItem(LS_KEY, JSON.stringify(trackQueue));
  } catch (err) {
    console.warn("saveQueueToStorage failed", err);
  }
}

function loadQueueFromStorage() {
  try {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as MoodSessionTrackType[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      // merge without duplicates (by spotify_track_id + session_id + listened_at if present)
      const existingKeys = new Set(trackQueue.map(k => `${k.session_id}:${k.spotify_track_id}:${k.listened_at ?? ""}`));
      for (const item of parsed) {
        const key = `${item.session_id}:${item.spotify_track_id}:${item.listened_at ?? ""}`;
        if (!existingKeys.has(key)) {
          trackQueue.push(item);
          existingKeys.add(key);
        }
      }
    }
  } catch (err) {
    console.warn("loadQueueFromStorage failed", err);
  }
}

/* Small helper to get a dedupe key for items */
function itemKey(item: MoodSessionTrackType) {
  return `${item.session_id}:${item.spotify_track_id}:${item.listened_at ?? ""}`;
}

/* Merge incoming items while avoiding duplicates */
function mergeIntoQueue(items: MoodSessionTrackType[]) {
  const existingKeys = new Set(trackQueue.map(itemKey));
  let pushed = 0;
  for (const it of items) {
    const k = itemKey(it);
    if (!existingKeys.has(k)) {
      trackQueue.push(it);
      existingKeys.add(k);
      pushed++;
    }
  }
  if (pushed > 0) saveQueueToStorage();
  return pushed;
}

/* =========================
   BroadcastChannel handlers
   ========================= */
if (bc) {
  bc.onmessage = (ev) => {
    try {
      const { type, payload } = ev.data || {};
      if (type === "enqueue" && Array.isArray(payload)) {
        // another tab enqueued items; merge them locally
        mergeIntoQueue(payload);
        scheduleFlush(); // ensure we flush sooner if needed
      } else if (type === "flushed") {
        // another tab flushed N items; we can attempt to remove duplicates if present
        // payload: { count: number, items?: MoodSessionTrackType[] }
        const remoteItems: MoodSessionTrackType[] | undefined = payload?.items;
        if (Array.isArray(remoteItems) && remoteItems.length) {
          // remove any items that were included in that flush
          const remoteKeys = new Set(remoteItems.map(itemKey));
          trackQueue = trackQueue.filter(x => !remoteKeys.has(itemKey(x)));
          saveQueueToStorage();
        } else {
          // if remote didn't include items, best-effort: do nothing
        }
      } else if (type === "replace") {
        // full queue replace (rare): payload is full queue
        if (Array.isArray(payload)) {
          trackQueue = payload;
          saveQueueToStorage();
        }
      }
    } catch (err) {
      console.warn("BroadcastChannel message handling failed", err);
    }
  };
}

/* =========================
   Public API functions
   ========================= */

/**
 * Get all tracks for a session (read from Supabase)
 */
export async function getSessionTracks(sessionId: string) {
  const { data, error } = await supabase
    .from("mood_tracks")
    .select("*")
    .eq("session_id", sessionId)
    .order("listened_at", { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Add a track log to the queue.
 * - Pushes to in-memory queue
 * - Persists to localStorage
 * - Broadcasts to other tabs
 * - Schedules a flush (with dynamic interval)
 */
export function queueTrackLog(toInsert: MoodSessionTrackType) {
  // Defensive: minimal validation
  if (!toInsert || !toInsert.session_id || !toInsert.spotify_track_id) {
    console.warn("queueTrackLog: invalid payload", toInsert);
    return;
  }

  // Avoid exact duplicates (same session_id + spotify_track_id + listened_at)
  const k = itemKey(toInsert);
  const existing = trackQueue.find(t => itemKey(t) === k);
  if (existing) return;

  trackQueue.push(toInsert);
  saveQueueToStorage();

  // Broadcast to other tabs so they can merge
  try {
    if (bc) bc.postMessage({ type: "enqueue", payload: [toInsert] });
  } catch (err) {
    // ignore bc errors
  }

  // If queue grows large, decrease flush interval to be more aggressive
  adjustFlushInterval();
  scheduleFlush();
}

/**
 * Returns the current number of queued items (local)
 */
export function getQueueLength() {
  return trackQueue.length;
}

/**
 * Clear the local queue (useful for tests or reset)
 */
export function clearQueue() {
  trackQueue = [];
  saveQueueToStorage();
  try {
    if (bc) bc.postMessage({ type: "replace", payload: [] });
  } catch {}
}

/* =========================
   Flush logic (dynamic + backoff)
   ========================= */

/* Schedule a flush according to the dynamic interval */
function scheduleFlush() {
  if (flushTimeout) return; // already scheduled

  // If nothing to flush, skip scheduling
  if (trackQueue.length === 0) return;

  // schedule
  flushTimeout = setTimeout(() => {
    flushTimeout = null;
    flushTrackLogs().catch((e) => {
      // errors are handled inside flushTrackLogs
      console.warn("flushTrackLogs scheduled call error", e);
    });
  }, flushIntervalMs);
}

/* Adjust the flush interval based on queue size */
function adjustFlushInterval() {
  // immediate conditions: many items -> faster flush
  if (trackQueue.length >= QUEUE_FAST_THRESHOLD) {
    flushIntervalMs = FAST_FLUSH_INTERVAL;
  } else {
    flushIntervalMs = BASE_FLUSH_INTERVAL;
  }
}

/**
 * flushTrackLogs
 * - Copies the current queue, clears it locally, attempts to insert
 * - On success: broadcasts 'flushed' with the items to allow other tabs to purge duplicates
 * - On failure: requeues items and applies backoff
 */
export async function flushTrackLogs() {
  if (isFlushing) return;
  if (trackQueue.length === 0) return;

  isFlushing = true;
  const toInsert = [...trackQueue];

  // optimistic local clear: remove them from the queue to avoid double-inserts if other tabs flush
  // but we keep a copy (toInsert) to re-queue on failure
  trackQueue = [];
  saveQueueToStorage();

  try {
    // Supabase insert: insert many rows
    const { error } = await supabase.from("mood_tracks").insert(toInsert);
    if (error) throw error;

    // success: reset backoff and interval
    backoffMs = BACKOFF_BASE;
    adjustFlushInterval(); // in case queue length changed

    // Broadcast success and include the flushed items so other tabs can remove duplicates
    try {
      if (bc) bc.postMessage({ type: "flushed", payload: { count: toInsert.length, items: toInsert } });
    } catch (err) {
      // non-fatal
    }
    console.log(`✅ Flushed ${toInsert.length} track logs`);
  } catch (err) {
    console.error("❌ Failed to flush track logs:", err);

    // Re-queue the items (put them at the front to preserve order)
    trackQueue.unshift(...toInsert);
    saveQueueToStorage();

    // Backoff: increase interval up to max
    backoffMs = Math.min(backoffMs * 2, BACKOFF_MAX);
    flushIntervalMs = backoffMs;

    // schedule next attempt
    if (flushTimeout) clearTimeout(flushTimeout);
    flushTimeout = setTimeout(() => {
      flushTimeout = null;
      flushTrackLogs().catch((e) => console.warn("flush retry error", e));
    }, flushIntervalMs);
  } finally {
    isFlushing = false;
  }
}

/* =========================
   Lifecycle: load persisted queue & install unload handler
   ========================= */
if (typeof window !== "undefined") {
  // On module load, hydrate from localStorage
  loadQueueFromStorage();

  // When the page unloads, attempt a final flush
  // We try to flush asynchronously; this may not always complete but helps avoid data loss.
  window.addEventListener("beforeunload", (ev) => {
    // Attempt synchronous best-effort: call flushTrackLogs and hope it completes.
    // Browsers may ignore async work on unload; for the best effort we can use navigator.sendBeacon
    // but since we're using supabase client we simply call flushTrackLogs synchronously.
    try {
      // If queue empty, nothing to do
      if (trackQueue.length === 0) return;

      // Try navigator.sendBeacon to a lightweight endpoint that could accept queued logs for server-side flush.
      // If you add a server endpoint (optional), you can implement sendBeacon here.
      // For now we call flushTrackLogs (async). This increases chances that logs are sent during quick unloads.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      flushTrackLogs();
    } catch (err) {
      // nothing else we can do
    }
  });

  // Visibility change: when the tab becomes hidden, attempt a flush (helps mobile / background)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      // attempt flush
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      flushTrackLogs();
    }
  });
}

/* =========================
   Exports
   ========================= */
// export {
//   // core api
//   queueTrackLog,
//   flushTrackLogs,
//   getSessionTracks,

//   // helpers
//   getQueueLength,
//   clearQueue,
// };
