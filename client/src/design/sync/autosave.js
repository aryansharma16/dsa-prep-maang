import { baseURL } from '../../api/http.js';
import { newId } from '../core/ids.js';
import { createOpQueue } from './opQueue.js';

/**
 * Saving a board, continuously, without ever losing an edit.
 *
 * - **Batched.** Changes are queued and coalesced (opQueue.js) and sent 800ms
 *   after the last one, or every 3s at most while someone keeps drawing.
 * - **One request at a time.** A batch keeps its id across retries, so the
 *   server recognises a retry of a save it already applied (see commitOps).
 * - **Nothing is dropped on failure.** A failed batch goes back into the queue
 *   underneath anything newer; network errors and 5xx back off up to 30s; a
 *   429 waits as long as the server says.
 * - **Crash-safe.** Pending changes are mirrored to localStorage, so a closed
 *   tab or a dead laptop restores them the next time the board opens.
 * - **Flushed on the way out.** When the page is hidden, what is pending goes
 *   out as a `keepalive` fetch — which survives the page closing — if it is
 *   small enough for the browser to allow.
 */

const DEBOUNCE_MS = 800;
const MAX_WAIT_MS = 3000;
const SHOW_SAVING_AFTER_MS = 300;
const KEEPALIVE_LIMIT = 60 * 1024;
const MIRROR_LIMIT = 2 * 1024 * 1024;

export const mirrorKey = (boardId) => `sd-pending:${boardId}`;

export function readMirror(boardId) {
  try {
    const raw = localStorage.getItem(mirrorKey(boardId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && Array.isArray(parsed.ops) && parsed.ops.length ? parsed : null;
  } catch {
    return null;
  }
}

export function clearMirror(boardId) {
  try {
    localStorage.removeItem(mirrorKey(boardId));
  } catch {
    /* private mode */
  }
}

export function createAutosave({ boardId, baseRev, send, onStatus, onResult, onRejected, onGone, onFatal }) {
  const clientId = newId(12);
  const queue = createOpQueue();
  let rev = baseRev;
  let inflight = null;
  let debounceTimer = 0;
  let firstPendingAt = 0;
  let retryTimer = 0;
  let backoff = 0;
  let savingTimer = 0;
  let mirrorTimer = 0;
  let stopped = false;
  let maxOps = 500;
  let status = { state: 'idle' };

  const setStatus = (next) => {
    status = next;
    onStatus?.(next);
  };

  /* ------------------------------------------------------------ mirror */

  function writeMirror() {
    mirrorTimer = 0;
    const ops = [...(inflight?.ops || []), ...queue.snapshot()];
    try {
      if (!ops.length) {
        localStorage.removeItem(mirrorKey(boardId));
        return;
      }
      const json = JSON.stringify({ baseRev: rev, at: Date.now(), ops });
      if (json.length <= MIRROR_LIMIT) localStorage.setItem(mirrorKey(boardId), json);
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
    if (stopped || inflight || !queue.size) return;
    if (retryTimer && !force) return;
    clearTimeout(retryTimer);
    retryTimer = 0;
    clearTimeout(debounceTimer);
    firstPendingAt = 0;

    const ops = queue.take({ maxOps });
    inflight = { batchId: `b-${newId(16)}`, ops };
    clearTimeout(savingTimer);
    savingTimer = setTimeout(() => setStatus({ state: 'saving' }), SHOW_SAVING_AFTER_MS);

    try {
      const result = await send({ batchId: inflight.batchId, clientId, baseRev: rev, ops });
      clearTimeout(savingTimer);
      backoff = 0;
      maxOps = Math.min(500, maxOps * 2);
      inflight = null;
      if (result.rev > rev) rev = result.rev;
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

    if (httpStatus === 413 && failed.ops.length > 1) {
      queue.requeue(failed.ops);
      maxOps = Math.max(1, Math.floor(failed.ops.length / 2));
      flush();
      return;
    }

    if (httpStatus === 404 || httpStatus === 410 || (httpStatus === 409 && code === 'PROJECT_ARCHIVED')) {
      stopped = true;
      queue.requeue(failed.ops);
      writeMirror();
      onGone?.({ status: httpStatus, code });
      return;
    }

    if (httpStatus === 400 || httpStatus === 413) {
      // The server says this batch can never succeed. Keep it in the mirror for
      // recovery, but stop retrying it — a batch that loops forever blocks
      // every change after it.
      try {
        localStorage.setItem(`sd-failed:${boardId}:${Date.now()}`, JSON.stringify(failed.ops).slice(0, MIRROR_LIMIT));
      } catch {
        /* ignore */
      }
      setStatus({ state: 'error', message: 'Some changes could not be saved', retryable: false });
      onFatal?.(error);
      writeMirror();
      if (queue.size) flush();
      return;
    }

    queue.requeue(failed.ops);
    scheduleMirror();
    const retryAfter = error?.response?.data?.error?.meta?.retryAfterSeconds;
    const delay = httpStatus === 429 && retryAfter ? retryAfter * 1000 : Math.min(30_000, 1000 * 2 ** backoff) * (0.75 + Math.random() * 0.5);
    backoff = Math.min(backoff + 1, 5);
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    setStatus(
      offline
        ? { state: 'offline', pending: queue.size }
        : { state: 'error', message: httpStatus === 429 ? 'Saving paused for a moment' : 'Couldn’t save', retryable: true },
    );
    retryTimer = setTimeout(() => {
      retryTimer = 0;
      flush();
    }, delay);
  }

  /* ------------------------------------------------------------ page lifecycle */

  function flushOnHide() {
    if (stopped) return;
    writeMirror();
    if (inflight || !queue.size) return;
    const ops = queue.snapshot();
    const body = JSON.stringify({ batchId: `b-${newId(16)}`, clientId, baseRev: rev, ops });
    if (body.length > KEEPALIVE_LIMIT) return;
    try {
      // The ops stay queued and mirrored: if this lands, the next save's response
      // will say so harmlessly; if it does not, nothing was lost.
      fetch(`${baseURL}/design/boards/${boardId}/ops`, {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body,
      }).catch(() => {});
    } catch {
      /* the mirror has it */
    }
  }

  const onVisibility = () => document.visibilityState === 'hidden' && flushOnHide();
  const onOnline = () => {
    backoff = 0;
    flush({ force: true });
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', flushOnHide);
  window.addEventListener('online', onOnline);

  return {
    clientId,
    enqueue(ops) {
      if (stopped || !ops.length) return;
      queue.addAll(ops);
      scheduleMirror();
      schedule();
      if (status.state === 'saved' || status.state === 'idle') setStatus({ state: 'dirty' });
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
      for (const op of inflight?.ops || []) ids.add(op.eid ?? op.el?.eid);
      return ids;
    },
    get hasPending() {
      return Boolean(inflight) || queue.size > 0;
    },
    stop() {
      stopped = true;
    },
    dispose() {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flushOnHide);
      window.removeEventListener('online', onOnline);
      clearTimeout(debounceTimer);
      clearTimeout(retryTimer);
      clearTimeout(savingTimer);
      if (mirrorTimer) {
        clearTimeout(mirrorTimer);
        writeMirror();
      }
      // Leaving a board is not a reason to lose its last second of work.
      if (!stopped && queue.size && !inflight) {
        const ops = queue.take({ maxOps: 1000 });
        send({ batchId: `b-${newId(16)}`, clientId, baseRev: rev, ops })
          .then(() => clearMirror(boardId))
          .catch(() => {
            queue.requeue(ops);
            writeMirror();
          });
      }
      stopped = true;
    },
  };
}
