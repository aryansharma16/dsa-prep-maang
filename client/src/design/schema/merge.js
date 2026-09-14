/**
 * Three-way merge of schema text, line by line.
 *
 * When a save is refused because someone else saved the schema first, we have
 * the text both sides started from (`base`), ours and theirs. Regions only one
 * side changed merge cleanly; regions both changed the same way too; regions
 * both changed differently are conflicts, reported rather than guessed at —
 * the board then asks which version to keep.
 *
 * The line matching is Myers' O(ND) diff, so the cost follows how much changed
 * rather than how long the schema is.
 *
 * Pure.
 */

const MAX_EDITS = 4000;

/** Pairs of matched line indices [i, j] between `a` and `b`, ascending. Null if they differ too much. */
export function matchLines(a, b) {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  const offset = max;
  let v = new Array(2 * max + 2).fill(0);
  const trace = [];
  let found = false;
  for (let d = 0; d <= Math.min(max, MAX_EDITS); d += 1) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]) ? v[offset + k + 1] : v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x += 1;
        y += 1;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        found = true;
        break;
      }
    }
    if (found) break;
  }
  if (!found) return null;
  // Walk the trace back to recover the snake of matches.
  const pairs = [];
  let x = n;
  let y = m;
  for (let d = trace.length - 1; d >= 0 && (x > 0 || y > 0); d -= 1) {
    const vd = trace[d];
    const k = x - y;
    const prevK = k === -d || (k !== d && vd[offset + k - 1] < vd[offset + k + 1]) ? k + 1 : k - 1;
    const prevX = vd[offset + prevK];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      x -= 1;
      y -= 1;
      pairs.push([x, y]);
    }
    if (d > 0) {
      x = prevX;
      y = prevY;
    }
  }
  return pairs.reverse();
}

const splitLines = (text) => String(text ?? '').split('\n');
const same = (a, b) => a.length === b.length && a.every((line, i) => line === b[i]);

/** `{ text, conflicts }` — `conflicts` counts regions both sides changed differently (then `text` is null). */
export function mergeText(base, mine, theirs) {
  if (mine === theirs) return { text: mine, conflicts: 0 };
  if (mine === base) return { text: theirs, conflicts: 0 };
  if (theirs === base) return { text: mine, conflicts: 0 };
  const b = splitLines(base);
  const m = splitLines(mine);
  const t = splitLines(theirs);
  const bm = matchLines(b, m);
  const bt = matchLines(b, t);
  if (!bm || !bt) return { text: null, conflicts: 1 };
  const inMine = new Map(bm);
  const inTheirs = new Map(bt);

  const out = [];
  let conflicts = 0;
  let bi = 0;
  let mi = 0;
  let ti = 0;
  const flush = (bEnd, mEnd, tEnd) => {
    const bc = b.slice(bi, bEnd);
    const mc = m.slice(mi, mEnd);
    const tc = t.slice(ti, tEnd);
    if (same(mc, bc)) out.push(...tc);
    else if (same(tc, bc) || same(mc, tc)) out.push(...mc);
    else conflicts += 1;
  };
  for (let i = 0; i < b.length; i += 1) {
    // A base line both sides kept is a stable point: everything before it is one chunk.
    if (inMine.has(i) && inTheirs.has(i) && inMine.get(i) >= mi && inTheirs.get(i) >= ti) {
      flush(i, inMine.get(i), inTheirs.get(i));
      out.push(b[i]);
      bi = i + 1;
      mi = inMine.get(i) + 1;
      ti = inTheirs.get(i) + 1;
    }
  }
  flush(b.length, m.length, t.length);
  return conflicts ? { text: null, conflicts } : { text: out.join('\n'), conflicts: 0 };
}
