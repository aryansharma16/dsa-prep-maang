import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { execute, toTransferable } from './run.js';

/**
 * SQLite, in a worker.
 *
 * ---------------------------------------------------------------------------
 * Why a worker at all, when the databases are six rows.
 *
 * Not for throughput — for **cancellation**. sql.js exposes no interrupt, and a
 * runaway query is very easy to write by accident in the exact section of the
 * curriculum that teaches recursion:
 *
 *   WITH RECURSIVE t AS (SELECT 1 UNION ALL SELECT n + 1 FROM t) SELECT * FROM t;
 *
 * That has no termination condition, and on the main thread it freezes the tab
 * with no way back except closing it — losing the query the reader had spent
 * ten minutes on. A worker can be `terminate()`d from outside and respawned,
 * which is the only reliable cancel available here. `useSqlEngine` owns that
 * timeout; this file just runs what it is told.
 *
 * The second reason is the ordinary one: parsing and executing stay off the
 * frame budget, which is the standard this repo holds itself to elsewhere.
 * ---------------------------------------------------------------------------
 *
 * The WASM arrives as a hashed asset URL rather than from a CDN, so the Lab
 * works offline once cached and adds no third-party origin to a page that has
 * none. `locateFile` is how sql.js is told where to find it — without that it
 * guesses a path relative to the document and 404s in a production build.
 *
 * The worker holds no state between messages beyond the initialised module.
 * Every run builds a fresh database (see `createDb`), because a problem whose
 * answer is an UPDATE mutates its own tables.
 */

/*
  One initialisation, shared by every message. The promise is created on first
  use rather than at module scope so that spawning a worker costs nothing until
  a query is actually run — a reader who opens a problem and reads the statement
  for a minute has not downloaded 640 KB yet.
*/
let ready = null;
const engine = () => {
  ready ??= initSqlJs({ locateFile: () => wasmUrl });
  return ready;
};

self.onmessage = async (event) => {
  const { id, type, payload } = event.data || {};

  if (type === 'warm') {
    /*
      An explicit "start fetching" that returns nothing. The workbench sends it
      when the editor is focused, so the download overlaps with typing rather
      than landing between pressing Run and seeing a result.
    */
    try {
      await engine();
      self.postMessage({ id, ok: true, warm: true });
    } catch (error) {
      self.postMessage({ id, ok: false, error: describe(error) });
    }
    return;
  }

  if (type !== 'run') {
    self.postMessage({ id, ok: false, error: `Unknown message "${type}"` });
    return;
  }

  try {
    const SQL = await engine();
    const { result, error, ms } = execute(SQL, payload);
    self.postMessage({ id, ok: !error, error, result: toTransferable(result), ms });
  } catch (error) {
    /*
      Reached only if the engine itself failed to load — a blocked asset, a
      browser without WASM. A query error never lands here; `execute` returns
      those as a string so a syntax error stays an ordinary answer.
    */
    self.postMessage({ id, ok: false, error: describe(error) });
  }
};

const describe = (error) =>
  error?.message ? `The SQL engine could not start: ${error.message}` : String(error);
