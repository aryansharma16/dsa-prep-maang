/**
 * The crash-recovery copies autosave keeps in localStorage, and what a board
 * does with the ones a closed or crashed tab left behind. Pure apart from the
 * storage it is handed, so it is tested without a browser.
 */

export const MIRROR_LIVE_MS = 12_000;

const PREFIX = 'sd-pending:';
export const mirrorKey = (boardId, clientId) => `${PREFIX}${boardId}:${clientId}`;
export const storage = () => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

/**
 * Every mirror for a board except `exceptClientId`'s: `[{ key, clientId, baseRev, at, sent, ops }]`,
 * oldest first. Reads the single-key format older versions wrote, too.
 */
export function readMirrors(boardId, exceptClientId = null, store = storage()) {
  if (!store) return [];
  const out = [];
  for (let i = 0; i < store.length; i += 1) {
    const key = store.key(i);
    if (!key || (key !== `${PREFIX}${boardId}` && !key.startsWith(`${PREFIX}${boardId}:`))) continue;
    try {
      const parsed = JSON.parse(store.getItem(key));
      if (!parsed || parsed.clientId === exceptClientId) continue;
      const sent = Array.isArray(parsed.sent) ? parsed.sent.filter((b) => b && Array.isArray(b.ops) && b.ops.length) : [];
      const ops = Array.isArray(parsed.ops) ? parsed.ops : [];
      if (!sent.length && !ops.length) continue;
      out.push({ key, clientId: parsed.clientId ?? null, baseRev: parsed.baseRev ?? 0, at: parsed.at ?? 0, closed: Boolean(parsed.closed), sent, ops });
    } catch {
      /* not ours, or corrupt */
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

export function removeMirrors(keys, store = storage()) {
  for (const key of keys) {
    try {
      store?.removeItem(key);
    } catch {
      /* private mode */
    }
  }
}

/**
 * What to do with other tabs' mirrors when a board opens.
 *
 * - Mirrors refreshed within MIRROR_LIVE_MS belong to a tab that is still open:
 *   leave them alone (`waitFor`), and look again later — unless the copy says
 *   its page closed (`pagehide`), which restores straight away.
 * - A sent batch whose id the board already has landed — its ops are dropped.
 * - If nothing is left, the mirror is just removed.
 * - If the board has moved on only by the batches that landed, no one else has
 *   written since: restore silently. Otherwise ask, because restoring would
 *   write over newer edits.
 *
 * Returns `{ remove, silent: { ops, keys }, ask: { ops, keys, at } | null, waitFor }`.
 */
export function planRestore(mirrors, board, now = Date.now()) {
  const recent = new Set(board.recentBatches || []);
  const plan = { remove: [], silent: { ops: [], keys: [] }, ask: null, waitFor: 0 };
  const askOps = [];
  const askKeys = [];
  let askAt = 0;
  for (const mirror of mirrors) {
    const age = now - mirror.at;
    // A copy written as its page closed is an orphan at once; otherwise a recent one belongs to a live tab.
    if (!mirror.closed && age < MIRROR_LIVE_MS) {
      plan.waitFor = Math.max(plan.waitFor, MIRROR_LIVE_MS - age + 250);
      continue;
    }
    const landed = mirror.sent.filter((batch) => recent.has(batch.batchId));
    const unsent = [...mirror.sent.filter((batch) => !recent.has(batch.batchId)).flatMap((batch) => batch.ops), ...mirror.ops];
    if (!unsent.length) {
      plan.remove.push(mirror.key);
    } else if (board.rev === mirror.baseRev + landed.length) {
      plan.silent.ops.push(...unsent);
      plan.silent.keys.push(mirror.key);
    } else {
      askOps.push(...unsent);
      askKeys.push(mirror.key);
      askAt = Math.max(askAt, mirror.at);
    }
  }
  if (askOps.length) plan.ask = { ops: askOps, keys: askKeys, at: askAt };
  return plan;
}
