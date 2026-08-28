import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The worker, its lifetime, and the timeout that is the whole point of it.
 *
 * Spawns lazily — the first `run` or `warm` creates it — so a reader who never
 * presses Run never downloads the engine. Terminated on unmount, which is not
 * housekeeping: StrictMode double-mounts every effect in development, so a hook
 * that forgot this would leave a worker and a 640 KB WASM instance behind on
 * every single mount, and the leak would never show up in production where the
 * double-mount does not happen.
 *
 * ---------------------------------------------------------------------------
 * The timeout.
 *
 * `terminate()` is the only way to stop a running query — sql.js has no
 * interrupt and a worker that is inside a loop never reads another message. So
 * a run that passes `TIMEOUT_MS` kills the worker outright and the next run
 * spawns a fresh one. That costs a re-download of the WASM from cache and about
 * ten milliseconds, which is a fair price for the tab still being usable.
 *
 * The pending promise is rejected with a message that says what happened rather
 * than a bare "timeout", because the query that gets you here is nearly always
 * a recursive CTE with no stopping condition and naming that saves a lot of
 * staring.
 * ---------------------------------------------------------------------------
 */

/**
 * Five seconds.
 *
 * The databases here are a dozen rows, so every correct query answers in single
 * -digit milliseconds and every incorrect-but-terminating one does too. This
 * bound is not for slow queries — there are none — it is for non-terminating
 * ones, and five seconds is long enough that nobody meets it by accident and
 * short enough that meeting it feels like an answer rather than a hang.
 */
const TIMEOUT_MS = 5000;

export function useSqlEngine() {
  const workerRef = useRef(null);
  const pending = useRef(new Map());
  const nextId = useRef(0);

  /** Whether a run is in flight, for the Run button's label. */
  const [busy, setBusy] = useState(false);

  const kill = useCallback((reason) => {
    const worker = workerRef.current;
    workerRef.current = null;
    if (worker) worker.terminate();

    /*
      Everything still waiting is settled here rather than left hanging. A
      terminated worker sends no further messages, so a promise not rejected
      now is never settled at all — and the Run button would stay disabled
      forever with no error on screen.
    */
    for (const [, entry] of pending.current) {
      clearTimeout(entry.timer);
      entry.reject(new Error(reason));
    }
    pending.current.clear();
    setBusy(false);
  }, []);

  const spawn = useCallback(() => {
    if (workerRef.current) return workerRef.current;

    /*
      `new URL(..., import.meta.url)` with `type: 'module'` is the form Vite
      understands — it bundles the worker as its own chunk and rewrites the URL.
      A plain string path works in dev and 404s in a production build.
    */
    const worker = new Worker(new URL('./engine.worker.js', import.meta.url), { type: 'module' });

    worker.onmessage = (event) => {
      const { id, ok, error, result, ms } = event.data || {};
      const entry = pending.current.get(id);
      if (!entry) return;

      clearTimeout(entry.timer);
      pending.current.delete(id);
      if (pending.current.size === 0) setBusy(false);

      entry.resolve({ ok: Boolean(ok), error: error || null, result: result || null, ms: ms ?? 0 });
    };

    worker.onerror = (event) => {
      kill(event.message || 'The SQL engine stopped unexpectedly.');
    };

    workerRef.current = worker;
    return worker;
  }, [kill]);

  const send = useCallback(
    (type, payload, { timeout = TIMEOUT_MS } = {}) => {
      const worker = spawn();
      const id = (nextId.current += 1);

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          kill(
            `That query did not finish within ${timeout / 1000} seconds and was stopped. ` +
              'A recursive CTE with no stopping condition is the usual cause.',
          );
        }, timeout);

        pending.current.set(id, { resolve, reject, timer });
        setBusy(true);
        worker.postMessage({ id, type, payload });
      });
    },
    [kill, spawn],
  );

  /**
   * Run a query against a freshly-built database.
   *
   * Resolves with `{ ok, error, result, ms }` for anything the engine can
   * answer — including a syntax error, which is an ordinary outcome and comes
   * back as `ok: false` with SQLite's own message. It **rejects** only when the
   * run was killed: a timeout, or the engine failing to start. Those are
   * different kinds of event and collapsing them would make a typo look like a
   * crash.
   */
  const run = useCallback(
    ({ setupSql, sql, checkSql }) =>
      send('run', { setupSql, sql, checkSql }).catch((error) => ({
        ok: false,
        error: error.message,
        result: null,
        ms: 0,
        killed: true,
      })),
    [send],
  );

  /** Start fetching the engine without running anything. Failures are silent. */
  const warm = useCallback(() => {
    send('warm', null, { timeout: 30000 }).catch(() => {});
  }, [send]);

  useEffect(() => () => kill('The page moved on.'), [kill]);

  return { run, warm, busy };
}
