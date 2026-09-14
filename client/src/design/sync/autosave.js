import { newId } from '../core/ids.js';
import { mirrorKey, storage } from './mirror.js';
import { createOpQueue } from './opQueue.js';

export { MIRROR_LIVE_MS, planRestore, readMirrors, removeMirrors } from './mirror.js';

/**
 * Saving a board, continuously, without ever losing an edit.
 *
 * - **Batched.** Changes are queued and coalesced (opQueue.js) and sent 800ms
 *   after the last one, or every 3s at most while someone keeps drawing.
 * - **One request at a time, and a batch keeps its id until it is settled.** A
 *   request that fails without a clear answer (network, 5xx, 429) may still have
 *   been applied, so the same batch — same id, same ops — is what gets retried,
 *   and the server recognises a repeat (commitOps) instead of applying it twice
 *   over someone else's newer edit. Newer edits wait behind it in the queue.
 * - **Crash-safe.** What is pending is mirrored to localStorage under a key of
 *   this tab's own (`sd-pending:<board>:<client>`), refreshed every few seconds
 *   while anything is pending. A mirror whose tab stopped refreshing it is an
 *   orphan: the next open of the board restores it — see `planRestore`.
 *   The mirror separates batches that were sent (and may have landed) from ops
 *   never sent, so a reopen can ask the board which batch ids it already has.
 * - **Flushed on the way out.** When the page is hidden, the pending batch goes
 *   out as a `keepalive` fetch, under the id it will be retried with.
 */

const DEBOUNCE_MS = 800;
const MAX_WAIT_MS = 3000;
const SHOW_SAVING_AFTER_MS = 300;
const KEEPALIVE_LIMIT = 60 * 1024;
const MIRROR_LIMIT = 2 * 1024 * 1024;
const HEARTBEAT_MS = 4000;

const newBatchId = () => `b-${newId(16)}`;

export function createAutosave({ boardId, baseRev, send, keepaliveUrl, onStatus, onResult, onRejected, onGone, onFatal, getSourceBase, onSourceSaved }) {
  const clientId = newId(12);
  const key = mirrorKey(boardId, clientId);
  const queue = createOpQueue();
  let rev = baseRev;
  let inflight = null; // { batchId, ops } being sent
  let held = null; // { batchId, ops } whose outcome is unknown — retried as is, before anything newer
  let debounceTimer = 0;
  let firstPendingAt = 0;
  let retryTimer = 0;
  let backoff = 0;
  let savingTimer = 0;
  let mirrorTimer = 0;
  let heartbeat = 0;
  let lastKeepalive = { batchId: null, at: 0 };
  let closing = false;
  let stopped = false;
  let maxOps = 500;
  let status = { state: 'idle' };

  const setStatus = (next) => {
    status = next;
    onStatus?.(next);
  };
  // A schema text change is compare-and-set: it names the source revision it was written against.
  const withBase = (ops) => ops.map((op) => (op.op === 'source' ? { ...op, base: getSourceBase?.() ?? 0 } : op));
  const pendingCount = () => queue.size + (held ? held.ops.length : 0) + (inflight ? inflight.ops.length : 0);

  /* ------------------------------------------------------------ mirror */

  function writeMirror() {
    clearTimeout(mirrorTimer);
    mirrorTimer = 0;
    const closed = closing;
    const sent = [inflight, held].filter(Boolean).map(({ batchId, ops }) => ({ batchId, ops }));
    const ops = queue.snapshot();
    const store = storage();
    if (!store) return;
    try {
      if (!sent.length && !ops.length) {
        store.removeItem(key);
        clearInterval(heartbeat);
        heartbeat = 0;
        return;
      }
      // `closed`: the page is going away, so the next open need not wait to see whether this tab is still alive.
      const json = JSON.stringify({ v: 2, clientId, baseRev: rev, at: Date.now(), closed: closed || undefined, sent, ops });
      if (json.length <= MIRROR_LIMIT) store.setItem(key, json);
      // Keep the mirror's timestamp fresh while this tab lives, so no other tab mistakes it for an orphan.
      if (!heartbeat && !closed) heartbeat = setInterval(writeMirror, HEARTBEAT_MS);
    } catch {
      /* quota or private mode — the in-memory queue still has everything */
    }
  }

  const scheduleMirror = () => {
    if (!mirrorTimer) mirrorTimer = setTimeout(writeMirror, 1000);
  };

  /* ------------------------------------------------------------ sending */

  function schedule() {
    if (stopped) return;
    const now = Date.now();
    if (!firstPendingAt) firstPendingAt = now;
    clearTimeout(debounceTimer);
    const wait = Math.max(0, Math.min(DEBOUNCE_MS, MAX_WAIT_MS - (now - firstPendingAt)));
    debounceTimer = setTimeout(() => flush(), wait);
  }

  async function flush({ force = false } = {}) {
    if (stopped || inflight || (!queue.size && !held)) return;
    if (retryTimer && !force) return;
    clearTimeout(retryTimer);
    retryTimer = 0;
    clearTimeout(debounceTimer);
    firstPendingAt = 0;

    inflight = held || { batchId: newBatchId(), ops: withBase(queue.take({ maxOps })) };
    held = null;
    const batch = inflight;
    clearTimeout(savingTimer);
    savingTimer = setTimeout(() => setStatus({ state: 'saving' }), SHOW_SAVING_AFTER_MS);

    try {
      const result = await send({ batchId: batch.batchId, clientId, baseRev: rev, ops: batch.ops });
      clearTimeout(savingTimer);
      backoff = 0;
      maxOps = Math.min(500, maxOps * 2);
      inflight = null;
      if (result.rev > rev) rev = result.rev;
      const sourceOp = batch.ops.find((op) => op.op === 'source');
      if (sourceOp && !result.rejected?.some((r) => r.op === 'source')) onSourceSaved?.(result.rev, sourceOp.text);
      if (result.rejected?.length) onRejected?.(result.rejected);
      onResult?.(result);
      writeMirror();
      if (queue.size) flush();
      else setStatus({ state: 'saved', at: Date.now() });
    } catch (error) {
      clearTimeout(savingTimer);
      handleFailure(error);
    }
  }

  function handleFailure(error) {
    const failed = inflight;
    inflight = null;
    const httpStatus = error?.response?.status;
    const code = error?.response?.data?.error?.code;

    // 413: the body never reached the handler, so nothing was applied — split and send again under new ids.
    if (httpStatus === 413 && failed.ops.length > 1) {
      queue.requeue(failed.ops);
      maxOps = Math.max(1, Math.floor(failed.ops.length / 2));
      flush();
      return;
    }

    if (httpStatus === 404 || httpStatus === 410 || (httpStatus === 409 && code === 'PROJECT_ARCHIVED')) {
      stopped = true;
      held = failed;
      writeMirror();
      onGone?.({ status: httpStatus, code });
      return;
    }

    if (httpStatus === 400 || httpStatus === 413) {
      // The server says this batch can never succeed. Keep a copy for recovery, but stop retrying
      // it — a batch that loops forever blocks every change after it.
      try {
        storage()?.setItem(`sd-failed:${boardId}:${Date.now()}`, JSON.stringify(failed.ops).slice(0, MIRROR_LIMIT));
      } catch {
        /* ignore */
      }
      setStatus({ state: 'error', message: 'Some changes could not be saved', retryable: false });
      onFatal?.(error);
      writeMirror();
      if (queue.size) flush();
      return;
    }

    // No clear answer: it may have been applied. Retry exactly this batch, under the same id.
    held = failed;
    scheduleMirror();
    const retryAfter = error?.response?.data?.error?.meta?.retryAfterSeconds;
    const delay = httpStatus === 429 && retryAfter ? retryAfter * 1000 : Math.min(30_000, 1000 * 2 ** backoff) * (0.75 + Math.random() * 0.5);
    backoff = Math.min(backoff + 1, 5);
    setStatus(isOffline() ? { state: 'offline', pending: pendingCount() } : { state: 'error', message: httpStatus === 429 ? 'Saving paused for a moment' : 'Couldn’t save', retryable: true });
    retryTimer = setTimeout(() => {
      retryTimer = 0;
      flush();
    }, delay);
  }

  const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

  /* ------------------------------------------------------------ page lifecycle */

  function flushOnHide() {
    if (stopped) return;
    if (!inflight && !held && queue.size) held = { batchId: newBatchId(), ops: withBase(queue.take({ maxOps: 1000 })) };
    writeMirror();
    const batch = inflight || held;
    if (!batch) return;
    // visibilitychange and pagehide both fire on close: one request per batch is enough.
    if (lastKeepalive.batchId === batch.batchId && Date.now() - lastKeepalive.at < 2000) return;
    const body = JSON.stringify({ batchId: batch.batchId, clientId, baseRev: rev, ops: batch.ops });
    if (body.length > KEEPALIVE_LIMIT || !keepaliveUrl) return;
    lastKeepalive = { batchId: batch.batchId, at: Date.now() };
    try {
      // If the page lives on, the batch is still held and goes out again under this id —
      // a repeat the server recognises. If it closes, the mirror knows which id to ask about.
      fetch(keepaliveUrl, {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body,
      }).catch(() => {});
    } catch {
      /* the mirror has it */
    }
    if (!inflight) schedule();
  }

  const onVisibility = () => document.visibilityState === 'hidden' && flushOnHide();
  // From pagehide until the page is shown again, every copy written says the page closed — Chromium
  // follows pagehide with a visibilitychange whose write must not clear the mark.
  const onPageHide = () => {
    closing = true;
    clearInterval(heartbeat);
    heartbeat = 0;
    flushOnHide();
  };
  // Back from the back/forward cache: alive after all, so the copy is live again.
  const onPageShow = (event) => {
    if (!event.persisted) return;
    closing = false;
    writeMirror();
  };

  const onOnline = () => {
    backoff = 0;
    flush({ force: true });
  };
  const hasDom = typeof document !== 'undefined' && typeof window !== 'undefined';
  if (hasDom) {
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('online', onOnline);
  }

  return {
    clientId,
    enqueue(ops) {
      if (stopped || !ops.length) return;
      queue.addAll(ops);
      scheduleMirror();
      schedule();
      if (status.state === 'offline') setStatus({ state: 'offline', pending: pendingCount() });
      else if (status.state === 'saved' || status.state === 'idle') setStatus({ state: 'dirty' });
    },
    flush,
    get rev() {
      return rev;
    },
    set rev(value) {
      rev = value;
    },
    /** Element ids with changes not yet acknowledged — remote updates must not overwrite these. */
    pendingIds() {
      const ids = new Set(queue.peek().map((op) => op.eid ?? op.el?.eid));
      for (const op of [...(inflight?.ops || []), ...(held?.ops || [])]) ids.add(op.eid ?? op.el?.eid);
      return ids;
    },
    /** A schema text change not yet acknowledged — remote text must not overwrite it. */
    get hasPendingSource() {
      return [...(inflight?.ops || []), ...(held?.ops || []), ...queue.peek(), ...queue.snapshot()].some((op) => op.op === 'source');
    },
    get hasPending() {
      return Boolean(inflight || held) || queue.size > 0;
    },
    stop() {
      stopped = true;
    },
    dispose() {
      if (hasDom) {
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('pagehide', onPageHide);
        window.removeEventListener('pageshow', onPageShow);
        window.removeEventListener('online', onOnline);
      }
      clearTimeout(debounceTimer);
      clearTimeout(retryTimer);
      clearTimeout(savingTimer);
      clearInterval(heartbeat);
      heartbeat = 0;
      // Leaving a board is not a reason to lose its last second of work.
      if (!stopped && !inflight && (held || queue.size)) {
        const batch = held || { batchId: newBatchId(), ops: withBase(queue.take({ maxOps: 1000 })) };
        held = batch;
        writeMirror();
        clearInterval(heartbeat);
        heartbeat = 0;
        send({ batchId: batch.batchId, clientId, baseRev: rev, ops: batch.ops })
          .then(() => {
            held = null;
            writeMirror();
          })
          .catch(() => {
            /* the mirror keeps it; it becomes an orphan the next open restores */
          });
      } else {
        writeMirror();
        clearInterval(heartbeat);
        heartbeat = 0;
      }
      stopped = true;
    },
  };
}
