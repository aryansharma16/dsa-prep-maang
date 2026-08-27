/**
 * Which editorials have been opened, and when.
 *
 * The gate in the table decides whether the link opens at all; this remembers
 * that it did, so the next attempt logged against that problem can arrive with
 * `peeked` already ticked instead of asking you to remember and be honest about
 * it half an hour later.
 *
 * Local, and deliberately so. It is a note-to-self spanning the twenty minutes
 * between opening an editorial and logging the sitting it belonged to — the
 * durable record is the `peeked` field on the attempt, written server-side once
 * you log. Losing this to a cleared cache costs one pre-ticked checkbox.
 *
 * Written through the same key shape as the rest of the app's local state, but
 * not through `useLocalState`: the readers are a table cell and a dialog that
 * never render at the same time, and a hook would make this a piece of React
 * state two components had to agree about rather than a fact on disk.
 */

const KEY = 'editorial-peeks';

/**
 * How long a peek stays attached to a problem.
 *
 * A peek and the attempt it belongs to happen in one sitting. A day is
 * generous; a peek from three weeks ago pre-ticking today's attempt would be a
 * quiet lie about a sitting you did honestly.
 */
const TTL_MS = 24 * 60 * 60 * 1000;

/** Never throws: private mode, a full quota and a corrupt value all read as none. */
function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function write(value) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Storage is full or blocked. The pre-tick is a convenience; the attempt
    // still logs, and the checkbox is still there to tick by hand.
  }
}

/** Record that this problem's editorial was opened just now. */
export function notePeek(problemId) {
  if (!problemId) return;
  const all = read();
  all[problemId] = Date.now();
  write(all);
}

/** Has this problem's editorial been opened recently enough to count? */
export function peekedOn(problemId) {
  const at = read()[problemId];
  return Boolean(at) && Date.now() - at < TTL_MS;
}

/**
 * Forget this problem's peek.
 *
 * Called once the attempt carrying it has been logged, so a second sitting on
 * the same problem the same day does not inherit the first one's peek. Also
 * sweeps everything expired, which is the only garbage collection this needs —
 * the map is bounded by how many editorials you open in a day.
 */
export function clearPeek(problemId) {
  const all = read();
  delete all[problemId];
  const now = Date.now();
  for (const [id, at] of Object.entries(all)) {
    if (now - at >= TTL_MS) delete all[id];
  }
  write(all);
}
