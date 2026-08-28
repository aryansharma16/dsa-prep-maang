import { registerShims } from './shims.js';

/**
 * Building a database and running a query against it.
 *
 * The part of the engine that is neither browser nor Node: it takes an already
 * initialised sql.js module and does the rest. `engine.worker.js` supplies that
 * module from a WASM asset in the browser; the seed verifier supplies it from
 * `node_modules` — and because both then come through here, a reference
 * solution is checked by exactly the code path the reader's query will take.
 *
 * Nothing in this file touches the DOM, the network or the filesystem.
 */

/**
 * A fresh in-memory database with the problem's schema and rows in it.
 *
 * Fresh every run, and that is not an optimisation to skip: a problem whose
 * answer is an `UPDATE` mutates its own tables, so reusing a handle would mean
 * the second run of the same query saw the first one's damage and failed for a
 * reason that had nothing to do with the query.
 */
export function createDb(SQL, setupSql) {
  const db = new SQL.Database();
  try {
    registerShims(db);
    if (setupSql?.trim()) db.run(setupSql);
    return db;
  } catch (error) {
    db.close();
    /*
      A failure here is ours, not the reader's — the setup SQL is ours and has
      been through the verifier. Saying so stops someone hunting for a mistake
      in a query that never ran.
    */
    throw new Error(`The problem's setup failed to load: ${error.message}`);
  }
}

/**
 * Run whatever was typed, and return the last result set.
 *
 * The **last** one, because `db.exec` runs every statement given to it and a
 * console is expected to show the answer to what you finished with — someone
 * exploring will leave a `SELECT * FROM …` above their real query, and
 * answering with the first result would grade the exploration.
 *
 * A run producing no result set at all — a bare `UPDATE`, say — returns `null`
 * rather than throwing. That is a real and ordinary outcome for the problems
 * graded through `checkSql`.
 */
export function runQuery(db, sql) {
  const results = db.exec(sql);
  if (!results.length) return null;
  const last = results[results.length - 1];
  return { columns: last.columns || [], values: last.values || [] };
}

/**
 * One complete run: build, execute, optionally re-query, tear down.
 *
 * `checkSql` is what makes a problem whose answer changes data gradeable. The
 * reader's statements run for their side effects, then the check query runs
 * against the database they left behind and *that* is the result compared. A
 * problem without one is graded on what the reader's own query returned.
 *
 * Returns `{ result, error, ms }`. An error is a string — SQLite's own message,
 * unedited, because "near \"FORM\": syntax error" is more useful than anything
 * this layer could say instead.
 */
export function execute(SQL, { setupSql, sql, checkSql }) {
  const started = Date.now();
  let db = null;

  try {
    db = createDb(SQL, setupSql);
    let result = runQuery(db, sql);
    if (checkSql?.trim()) result = runQuery(db, checkSql);
    return { result, error: null, ms: Date.now() - started };
  } catch (error) {
    return { result: null, error: error.message || String(error), ms: Date.now() - started };
  } finally {
    /*
      sql.js allocates inside the WASM heap, which the JS garbage collector
      cannot see. A database that is not closed is leaked for the life of the
      worker, and the worker outlives every run in a session.
    */
    if (db) {
      try {
        db.close();
      } catch {
        /* Already closed, or the module is gone. Nothing to do and nothing to say. */
      }
    }
  }
}

/**
 * The shape of a result, as a plain object safe to `postMessage`.
 *
 * sql.js hands back arrays of primitives already, so this is a pass-through in
 * practice — it exists so the worker protocol has one named place to change if
 * a value type ever needs converting on the way out.
 */
export const toTransferable = (result) =>
  result ? { columns: [...result.columns], values: result.values.map((row) => [...row]) } : null;
