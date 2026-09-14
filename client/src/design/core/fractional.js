/**
 * Order keys that sort between any two others, without renumbering anything.
 *
 * The system design module needs positions in two places — siblings in a
 * project's folder tree, and the paint order of elements on a board — and both
 * are lists that get reordered one item at a time by a drag. Integers rewritten
 * across the whole list (what `Task.order` does) are the right call for a column
 * of twenty cards and the wrong one here: a board holds thousands of elements,
 * and once two people can edit one, "rewrite every sibling" is a conflict on
 * every reorder rather than a write to the one thing that moved.
 *
 * So a key is a string, and `keyBetween(a, b)` returns one that sorts strictly
 * between them. Nothing is ever rebalanced: appending or prepending forever
 * grows keys logarithmically, and inserting between two neighbours adds about a
 * character per halving.
 *
 * This is David Greenspan's scheme as published by rocicorp
 * (github.com/rocicorp/fractional-indexing, CC0): a variable-length integer part
 * whose length is encoded in its head character, followed by a base-62 fraction
 * with no trailing zero. The server carries an identical copy in
 * server/src/utils/fractionalIndex.js — the two must produce the same keys, so
 * both are pinned by the same test vectors.
 *
 * **Compare keys with `<`, never `localeCompare`.** The alphabet is in ASCII
 * order, so byte order is the intended order; a locale-aware comparison folds
 * case and puts `a` next to `A`. For the same reason the collections storing
 * these must never be given a collation.
 */

export const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ZERO = DIGITS[0];
const SMALLEST_INTEGER = `A${ZERO.repeat(26)}`;

function midpoint(a, b) {
  if (b != null && a >= b) throw new Error(`${a} >= ${b}`);
  if (a.slice(-1) === ZERO || (b && b.slice(-1) === ZERO)) throw new Error('trailing zero');
  if (b) {
    // Skip the shared prefix, and find the midpoint of what is left.
    let n = 0;
    while ((a[n] || ZERO) === b[n]) n += 1;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }
  const digitA = a ? DIGITS.indexOf(a[0]) : 0;
  const digitB = b != null ? DIGITS.indexOf(b[0]) : DIGITS.length;
  if (digitB - digitA > 1) return DIGITS[Math.round(0.5 * (digitA + digitB))];
  // The first digits are consecutive.
  if (b && b.length > 1) return b.slice(0, 1);
  return DIGITS[digitA] + midpoint(a.slice(1), null);
}

function integerLength(head) {
  if (head >= 'a' && head <= 'z') return head.charCodeAt(0) - 97 + 2;
  if (head >= 'A' && head <= 'Z') return 90 - head.charCodeAt(0) + 2;
  throw new Error(`invalid order key head: ${head}`);
}

function integerPart(key) {
  const length = integerLength(key[0]);
  if (length > key.length) throw new Error(`invalid order key: ${key}`);
  return key.slice(0, length);
}

function assertKey(key) {
  if (key === SMALLEST_INTEGER) throw new Error(`invalid order key: ${key}`);
  const int = integerPart(key);
  if (key.slice(int.length).slice(-1) === ZERO) throw new Error(`invalid order key: ${key}`);
}

function incrementInteger(x) {
  const [head, ...digits] = x.split('');
  let carry = true;
  for (let i = digits.length - 1; carry && i >= 0; i -= 1) {
    const d = DIGITS.indexOf(digits[i]) + 1;
    if (d === DIGITS.length) digits[i] = ZERO;
    else {
      digits[i] = DIGITS[d];
      carry = false;
    }
  }
  if (!carry) return head + digits.join('');
  if (head === 'Z') return `a${ZERO}`;
  if (head === 'z') return null;
  const next = String.fromCharCode(head.charCodeAt(0) + 1);
  if (next > 'a') digits.push(ZERO);
  else digits.pop();
  return next + digits.join('');
}

function decrementInteger(x) {
  const [head, ...digits] = x.split('');
  let borrow = true;
  for (let i = digits.length - 1; borrow && i >= 0; i -= 1) {
    const d = DIGITS.indexOf(digits[i]) - 1;
    if (d === -1) digits[i] = DIGITS.slice(-1);
    else {
      digits[i] = DIGITS[d];
      borrow = false;
    }
  }
  if (!borrow) return head + digits.join('');
  if (head === 'a') return `Z${DIGITS.slice(-1)}`;
  if (head === 'A') return null;
  const next = String.fromCharCode(head.charCodeAt(0) - 1);
  if (next < 'Z') digits.push(DIGITS.slice(-1));
  else digits.pop();
  return next + digits.join('');
}

/**
 * A key strictly between `a` and `b`. Either may be null, meaning "the start"
 * and "the end" — so `keyBetween(last, null)` appends and `keyBetween(null,
 * first)` prepends. Throws on keys that are malformed or out of order, which is
 * a bug in the caller rather than something to recover from.
 */
export function keyBetween(a, b) {
  if (a != null) assertKey(a);
  if (b != null) assertKey(b);
  if (a != null && b != null && a >= b) throw new Error(`${a} >= ${b}`);

  if (a == null) {
    if (b == null) return `a${ZERO}`;
    const ib = integerPart(b);
    const fb = b.slice(ib.length);
    if (ib === SMALLEST_INTEGER) return ib + midpoint('', fb);
    if (ib < b) return ib;
    const res = decrementInteger(ib);
    if (res == null) throw new Error('cannot decrement any more');
    return res;
  }

  if (b == null) {
    const ia = integerPart(a);
    const fa = a.slice(ia.length);
    const i = incrementInteger(ia);
    return i == null ? ia + midpoint(fa, null) : i;
  }

  const ia = integerPart(a);
  const fa = a.slice(ia.length);
  const ib = integerPart(b);
  const fb = b.slice(ib.length);
  if (ia === ib) return ia + midpoint(fa, fb);
  const i = incrementInteger(ia);
  if (i == null) throw new Error('cannot increment any more');
  if (i < b) return i;
  return ia + midpoint(fa, null);
}

/** `n` ascending keys between `a` and `b`, spread evenly rather than bunched at one end. */
export function keysBetween(a, b, n) {
  if (n === 0) return [];
  if (n === 1) return [keyBetween(a, b)];
  if (b == null) {
    let c = keyBetween(a, b);
    const out = [c];
    for (let i = 0; i < n - 1; i += 1) {
      c = keyBetween(c, b);
      out.push(c);
    }
    return out;
  }
  if (a == null) {
    let c = keyBetween(a, b);
    const out = [c];
    for (let i = 0; i < n - 1; i += 1) {
      c = keyBetween(a, c);
      out.push(c);
    }
    return out.reverse();
  }
  const mid = Math.floor(n / 2);
  const c = keyBetween(a, b);
  return [...keysBetween(a, c, mid), c, ...keysBetween(c, b, n - mid - 1)];
}

/** True for a well-formed key. For validating keys a client sent, where throwing is the wrong shape. */
export function isOrderKey(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) return false;
  if (!/^[0-9A-Za-z]+$/.test(value)) return false;
  try {
    assertKey(value);
    return true;
  } catch {
    return false;
  }
}
