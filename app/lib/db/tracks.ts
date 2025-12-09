// lib/db/tracks.ts
// IndexedDB-only queue, BroadcastChannel sync, chunked flush, partial requeue, sendBeacon-friendly.

import type { FinalizedTrackLog, FlushedItemsType, FlushedTrackResponse, FlushedTrackResult, QueueStoredTrackLog } from "@/lib/Playback/types";

const DB_NAME = "mood-logs-db";
const STORE_NAME = "queue";
const DB_VERSION = 1;
const BC_CHANNEL = "mood-track-queue-v3";
const CHUNK_SIZE = 50;
const BASE_FLUSH_INTERVAL = 5000;
const FAST_FLUSH_INTERVAL = 2000;
const QUEUE_FAST_THRESHOLD = 10;
const BACKOFF_BASE = 2000;
const BACKOFF_MAX = 60_000;

let dbPromise: Promise<IDBDatabase> | null = null;
let inMemoryQueue: QueueStoredTrackLog[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
let flushIntervalMs = BASE_FLUSH_INTERVAL;
let backoffMs = BACKOFF_BASE;
let isFlushing = false;

const bc: BroadcastChannel | null = typeof window !== "undefined" && "BroadcastChannel" in window ? new BroadcastChannel(BC_CHANNEL) : null;

/* ==================== IDB helper (tiny promise wrapper) ==================== */
function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = (ev.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "idempotency_key" });
        store.createIndex("session_id", "session_id", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function idbPutItems(items: QueueStoredTrackLog[]) {
  const db = await openDb();
  return new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    for (const it of items) store.put(it);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

async function idbGetAll(): Promise<QueueStoredTrackLog[]> {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => res(req.result as QueueStoredTrackLog[]);
    req.onerror = () => rej(req.error);
  });
}

async function idbDeleteKeys(keys: string[]) {
  if (!keys.length) return;
  const db = await openDb();
  return new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    for (const k of keys) store.delete(k);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

async function idbClear() {
  const db = await openDb();
  return new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

/* ==================== In-memory + IDB sync helpers ==================== */

function keyForDedup(item: Partial<QueueStoredTrackLog> | Partial<FinalizedTrackLog>) {
  if (item.idempotency_key) return item.idempotency_key as string;
  return `${item.session_id}:${item.spotify_track_id}:${item.listened_at ?? ""}`;
}

export async function loadQueueFromIDBToMemory() {
  try {
    const items = await idbGetAll();
    // dedupe onto inMemoryQueue
    const existing = new Set(inMemoryQueue.map(keyForDedup));
    for (const it of items) {
      if (!existing.has(keyForDedup(it))) {
        inMemoryQueue.push(it);
        existing.add(keyForDedup(it));
      }
    }
  } catch (err) {
    console.warn("Failed to load queue from IDB", err);
  }
}

/* ============ Public API ============ */

/** Enqueue a finalized log (FinalizedTrackLog) -> becomes QueueStoredTrackLog and is persisted to IDB */
export async function enqueueFinalizedLog(finalized: FinalizedTrackLog) {
  if (!finalized || !finalized.session_id || !finalized.spotify_track_id) {
    console.warn("Invalid finalized log", finalized);
    return;   
  }

  const stored: QueueStoredTrackLog = {
    ...finalized,
    idempotency_key: finalized.idempotency_key ?? crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
  };

  // in-memory dedupe
  if (inMemoryQueue.find(q => keyForDedup(q) === keyForDedup(stored))) return;

  // persist to IDB and to memory
  try {
    await idbPutItems([stored]);
    inMemoryQueue.push(stored);
    // notify other tabs
    try { if (bc) bc.postMessage({ type: "enqueue", payload: [stored] }); } catch {}
    adjustFlushInterval();
    scheduleFlush();
  } catch (err) {
    console.warn("Failed to persist track log to IDB", err);
    // keep in memory as last resort
    inMemoryQueue.push(stored);
    adjustFlushInterval();
    scheduleFlush();
  }
}

/** Merge incoming queue items (from other tab) */
export function mergeIntoQueue(items: QueueStoredTrackLog[]) {
  const existing = new Set(inMemoryQueue.map(keyForDedup));
  let pushed = 0;
  for (const it of items) {
    if (!existing.has(keyForDedup(it))) {
      inMemoryQueue.push(it);
      existing.add(keyForDedup(it));
      pushed++;
    }
  }
  if (pushed) {
    // persist added items
    idbPutItems(items).catch(err => console.warn("mergeIntoQueue persist failed", err));
  }
  adjustFlushInterval();
  return pushed;
}

export function getQueueLength() {
  return inMemoryQueue.length;
}

export async function clearQueue() {
  inMemoryQueue = [];
  try { await idbClear(); } catch (err) { console.warn("Failed to clear IDB", err); }
  try { if (bc) bc.postMessage({ type: "replace", payload: [] }); } catch {}
}

/* ================= BroadcastChannel sync ================= */
if (bc) {
  bc.onmessage = (ev) => {
    try {
      const { type, payload } = ev.data || {};
      if (type === "enqueue" && Array.isArray(payload)) {
        mergeIntoQueue(payload);
        scheduleFlush();
      } else if (type === "flushed") {
        const remoteItems:FlushedItemsType = payload?.items;
        if (Array.isArray(remoteItems) && remoteItems.length) {
          const remoteKeys = new Set(remoteItems.map((r) => keyForDedup(r)));
          inMemoryQueue = inMemoryQueue.filter(x => !remoteKeys.has(keyForDedup(x)));
          // remove from IDB
          // const keysToDelete = inMemoryQueue.length ? [] : remoteItems.map((r) => r.idempotency_key);
          // safer: delete the flushed keys specifically
          const flushedKeys = remoteItems.map((r) => r.idempotency_key).filter(Boolean);
          if (flushedKeys.length) idbDeleteKeys(flushedKeys).catch(err => console.warn("idb delete failed", err));
        }
      } else if (type === "replace" && Array.isArray(payload)) {
        inMemoryQueue = payload;
        // best-effort persist
        idbPutItems(inMemoryQueue).catch(() => {});
      }
    } catch (err) {
      console.warn("BC message error", err);
    }
  };
}

/* ============== FLUSH LOGIC (with partial requeue) ============== */

function adjustFlushInterval() {
  flushIntervalMs = inMemoryQueue.length >= QUEUE_FAST_THRESHOLD ? FAST_FLUSH_INTERVAL : BASE_FLUSH_INTERVAL;
}

function scheduleFlush() {
  if (flushTimeout) return;
  if (inMemoryQueue.length === 0) return;
  flushTimeout = setTimeout(async () => {
    flushTimeout = null;
    try {
      await flushTrackLogs();
    } catch (e) {
      console.warn("scheduled flush error", e);
    }
  }, flushIntervalMs);
}

/** Flush: chunk items, POST to server, remove successful items from IDB and memory, requeue failed items only */
export async function flushTrackLogs() {
  if (isFlushing) return;
  if (inMemoryQueue.length === 0) return;
  isFlushing = true;

  // snapshot & clear memory optimistically
  const toProcess = [...inMemoryQueue];
  inMemoryQueue = [];
  // We won't clear IDB until we know which keys succeeded; but to avoid duplicates we will handle deletes individually.

  // split into chunks
  const chunks: QueueStoredTrackLog[][] = [];
  for (let i = 0; i < toProcess.length; i += CHUNK_SIZE) {
    chunks.push(toProcess.slice(i, i + CHUNK_SIZE));
  }

  try {
    const successfulKeys: string[] = [];
    const failedItems: QueueStoredTrackLog[] = [];

    for (const chunk of chunks) {
      const res = await fetch("/api/track-logs/flush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracks: chunk }),
        keepalive: true,
      });

      if (!res.ok) {
        // entire chunk treated as failed -> requeue all chunk items
        console.warn("Chunk flush failed, will requeue chunk", await res.text());
        failedItems.push(...chunk);
        continue;
      }

      const json = await res.json();
      // expected shape: { inserted: number, results: [{ idempotency_key, status }, ...] }
      const results:FlushedTrackResult[] = Array.isArray(json.results) ? json.results : [];
      const insertedKeys = new Set(results.filter((r) => r.status === "inserted").map((r) => r.idempotency_key));
      const duplicateKeys = new Set(results.filter((r) => r.status === "duplicate" || r.status === "exists").map((r) => r.idempotency_key));
      
      // treat duplicate as success (we can delete local)
      for (const r of results) {
        if (insertedKeys.has(r.idempotency_key) || duplicateKeys.has(r.idempotency_key)) {
          successfulKeys.push(r.idempotency_key);
        } else {
          // failed item
          const failed = chunk.find(c => c.idempotency_key === r.idempotency_key);
          if (failed) failedItems.push(failed);
        }
      }

      // For any items in chunk not present in results (server omitted them) -> treat as failed to be safe
      const resultKeys = new Set(results.map((r) => r.idempotency_key));
      for (const c of chunk) {
        if (!resultKeys.has(c.idempotency_key)) {
          failedItems.push(c);
        }
      }
    }

    // Delete successfulKeys from IDB (if any)
    if (successfulKeys.length) {
      await idbDeleteKeys(successfulKeys);
      // broadcast deletion so other tabs prune duplicates
      try { if (bc) bc.postMessage({ type: "flushed", payload: { count: successfulKeys.length, items: successfulKeys.map(k => ({ idempotency_key: k })) } }); } catch {}
    }

    // Requeue failed items into memory and IDB
    if (failedItems.length) {
      // dedupe against memory
      const existing = new Set(inMemoryQueue.map(keyForDedup));
      const requeueUnique: QueueStoredTrackLog[] = [];
      for (const fi of failedItems) {
        if (!existing.has(keyForDedup(fi))) {
          inMemoryQueue.push(fi);
          requeueUnique.push(fi);
          existing.add(keyForDedup(fi));
        }
      }
      if (requeueUnique.length) {
        // persist them back to IDB
        try {
          await idbPutItems(requeueUnique);
        } catch (err) {
          console.warn("Failed to persist requeued items", err);
        }
      }
    }

    // reset backoff and schedule next flush if needed
    backoffMs = BACKOFF_BASE;
    adjustFlushInterval();
    return { insertedCount: successfulKeys.length };
  } catch (err) {
    console.error("flushTrackLogs fatal error, requeueing all", err);
    // requeue all to memory and IDB (dedupe)
    const existing = new Set(inMemoryQueue.map(keyForDedup));
    const requeueAll: QueueStoredTrackLog[] = [];
    for (const item of toProcess) {
      if (!existing.has(keyForDedup(item))) {
        inMemoryQueue.push(item);
        requeueAll.push(item);
        existing.add(keyForDedup(item));
      }
    }
    try {
      await idbPutItems(requeueAll);
    } catch (e) {
      console.warn("Failed to persist requeueAll", e);
    }

    // backoff
    backoffMs = Math.min(backoffMs * 2, BACKOFF_MAX);
    flushIntervalMs = backoffMs;
    if (flushTimeout) clearTimeout(flushTimeout);
    flushTimeout = setTimeout(() => {
      flushTimeout = null;
      flushTrackLogs().catch(e => console.warn("flush retry error", e));
    }, flushIntervalMs);

    return { insertedCount: 0, error: String(err) };
  } finally {
    isFlushing = false;
  }
}

/* ============ beacon helper ============ */
/** Called by beforeunload to try a last-ditch flush using sendBeacon
 *  Will try to send up to CHUNK_SIZE items
 */
export function sendBeaconFlush() {
  try {
    if (!("sendBeacon" in navigator) || inMemoryQueue.length === 0) return false;
    // take up to CHUNK_SIZE
    const chunk = inMemoryQueue.slice(0, CHUNK_SIZE);
    const payload = JSON.stringify({ tracks: chunk });
    const sent = navigator.sendBeacon("/api/track-logs/beacon", new Blob([payload], { type: "application/json" }));
    if (sent) {
      // optimistic: remove those keys from IDB
      const keys = chunk.map(c => c.idempotency_key).filter(Boolean) as string[];
      idbDeleteKeys(keys).catch(() => {});
      inMemoryQueue = inMemoryQueue.slice(chunk.length);
      try { if (bc) bc.postMessage({ type: "flushed", payload: { count: chunk.length, items: chunk } }); } catch {}
      return true;
    }
    return false;
  } catch (err) {
    console.warn("sendBeaconFlush failed", err);
    return false;
  }
}

/* ============ lifecycle (load + unload handlers) ============ */
if (typeof window !== "undefined") {
  // on module load, hydrate from IDB into memory
  openDb().then(() => loadQueueFromIDBToMemory()).catch(() => {});

  // beforeunload: use sendBeacon if available (best-effort)
  window.addEventListener("beforeunload", () => {
    // try sendBeacon first (best attempt)
    try { sendBeaconFlush(); } catch (e) {console.warn(e)}
    // also try keepalive async flush (not guaranteed or for fallback)
    flushTrackLogs().catch(() => {});
  });

  // visibility -> flush when hidden
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      // give a best-effort try
      sendBeaconFlush();
      flushTrackLogs().catch(() => {});
    }
  });
}

/* ============ exports ============ */
// export {
//   flushTrackLogs,
//   enqueueFinalizedLog,
//   mergeIntoQueue,
//   loadQueueFromIDBToMemory,
//   getQueueLength,
//   clearQueue,
//   sendBeaconFlush,
// };
