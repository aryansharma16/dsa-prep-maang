import { useEffect, useState } from 'react';
import { motivationApi } from '../api/index.js';

/**
 * The line for one page, cached for as long as the situation behind it holds.
 *
 * The server already returns a stable pick — the same signals produce the same
 * line all day — so this cache is not about correctness, it is about not making
 * a request every time someone moves between Roadmap and Stats. Module scope
 * rather than state, for the same reason useGuide.js does it: pages unmount
 * constantly and a cache that unmounts with them is not a cache.
 *
 * The key is `surface:revision`, where revision is the caller's "something
 * changed" token — the solved count. Solving a problem changes it, so the
 * entry is a miss and the line is re-fetched with the new situation; navigating
 * does not, so it is a hit. That is the whole invalidation strategy, and it
 * needs no event bus.
 */
const cache = new Map();
const inflight = new Map();

/** Small: one string per surface per solved-count, and only ones seen today. */
const LIMIT = 40;

function remember(key, line) {
  if (cache.size >= LIMIT) cache.clear();
  cache.set(key, line);
}

function fetchLine(surface, key) {
  if (inflight.has(key)) return inflight.get(key);

  const task = motivationApi
    .get(surface)
    .then((line) => {
      remember(key, line ?? null);
      return line ?? null;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, task);
  return task;
}

/**
 * @param {string} surface  roadmap | stats | profile | revision
 * @param {number|string} [revision]  changes when the user's progress does
 * @returns {{line: object|null}}
 */
export function useMotivation(surface, revision = '') {
  const key = `${surface}:${revision}`;
  const [line, setLine] = useState(() => cache.get(key) ?? null);

  useEffect(() => {
    if (cache.has(key)) {
      setLine(cache.get(key));
      return undefined;
    }

    let live = true;
    // Deliberately not cleared first. A page that already has a line should
    // keep showing it while the next one loads, or every solve makes the strip
    // blink out and back — which is worse than a line that is a second stale.
    fetchLine(surface, key)
      .then((next) => live && setLine(next))
      // Silent. This is decoration: a failure means no line, never a message
      // about a failure to fetch a motivational quote.
      .catch(() => live && setLine(null));

    return () => {
      live = false;
    };
  }, [surface, key]);

  return { line };
}
