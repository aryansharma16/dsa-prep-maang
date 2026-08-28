/**
 * The MySQL functions SQLite does not have.
 *
 * The Lab runs on SQLite compiled to WASM, and the answers people write are
 * MySQL — because that is the dialect LeetCode grades, the dialect interview
 * questions assume, and the dialect the Learn track teaches. Without these,
 * `IFNULL(bonus, 0)` runs and `DATEDIFF(a, b)` does not, which would make the
 * Lab quietly disagree with the notes sitting one menu row above it.
 *
 * Each one is registered with `db.create_function`, so the reader's query is
 * never rewritten — SQLite simply gains the function and resolves the call
 * itself. Nothing here parses or transforms SQL, and that is deliberate: a
 * rewriter is a second SQL implementation, and a second SQL implementation is a
 * second set of bugs nobody can see from the query they typed.
 *
 * ---------------------------------------------------------------------------
 * Why this file is imported by the server's seed verifier too.
 *
 * `blocks.js` is deliberately duplicated between the client and the seed
 * scripts, and the reasoning there is sound: they are two authoring surfaces
 * and a drift between them is visible immediately in the output.
 *
 * This is the opposite case. The verifier generates each problem's *expected*
 * result by running its reference solution, and the browser then compares the
 * reader's result against that. If the two ran different shims, the expected
 * grid would disagree with what a correct query produces — and the symptom
 * would be a reader marked wrong for being right, with nothing on screen
 * pointing at the cause. So there is one copy, imported across, and the
 * sql.js version is pinned exactly in both package.json files for the same
 * reason.
 * ---------------------------------------------------------------------------
 *
 * The file is pure and dependency-free so that reaching across for it costs
 * nothing and pulls nothing in.
 */

/* SQLite stores dates as ISO strings. Everything below agrees on that. */
const DAY_MS = 86400000;

/** `null` in, `null` out — every one of these follows SQL's own rule. */
const nullish = (v) => v === null || v === undefined;

const toDate = (value) => {
  if (nullish(value)) return null;
  const d = new Date(typeof value === 'number' ? value : String(value).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
};

const iso = (d) => d.toISOString().slice(0, 10);
const pad = (n, width = 2) => String(n).padStart(width, '0');

/**
 * The registrations, as `[name, arity, fn]`.
 *
 * Arity is written down rather than taken from `fn.length`, because sql.js
 * infers it from the function's declared parameters and a default value or a
 * rest parameter silently changes that number. An explicit list is one line
 * longer and cannot drift away from what the wrapper actually accepts.
 */
const FUNCTIONS = [
  /* ---------------------------------------------------------------- null */

  /*
    `IFNULL`, `COALESCE`, `NULLIF`, `concat` and `concat_ws` are all native in
    the SQLite this runs on (3.49) and are deliberately **not** listed. Shimming
    a builtin would replace a correct implementation with a hand-written one for
    no gain, and `registerShims` below refuses to register a name twice for a
    related reason.

    One dialect difference falls out of that and is worth knowing: MySQL's
    `CONCAT` returns NULL if any argument is NULL, and SQLite's native `concat`
    skips NULLs instead. `CONCAT_WS` skips them in both. Expected results are
    generated on this same engine so nothing disagrees with itself, but a
    problem that turns on that behaviour should say so in its `dialectNote`.
  */

  /*
    `ISNULL` is deliberately absent, and cannot be added. SQLite reserves it as
    a **postfix operator** — `x ISNULL` means `x IS NULL` — so registering a
    function by that name parses as a syntax error at the opening bracket rather
    than resolving to the shim. MySQL's one-argument `ISNULL(x)` therefore has
    no equivalent here; `x IS NULL` is identical in both dialects and is what
    the Learn track teaches anyway.
  */
  ['NVL', 2, (a, b) => (nullish(a) ? b : a)],

  /* -------------------------------------------------------- conditionals */

  /*
    MySQL's IF(cond, then, else). SQLite has IIF() from 3.32, and the sql.js
    build is newer than that — but the reader types what the notes taught,
    and the notes teach MySQL.

    Truthiness follows MySQL rather than JavaScript: 0 is false, and so is
    '0' and ''. Using JS truthiness here would make IF('0', a, b) return `a`,
    which is the opposite of what the same query does on the engine the
    problem was written for.
  */
  [
    'IF',
    3,
    (cond, then, otherwise) => {
      if (nullish(cond)) return otherwise;
      if (typeof cond === 'number') return cond !== 0 ? then : otherwise;
      const n = Number(cond);
      if (!Number.isNaN(n)) return n !== 0 ? then : otherwise;
      return cond ? then : otherwise;
    },
  ],

  /* -------------------------------------------------------------- string */

  ['LEFT', 2, (s, n) => (nullish(s) || nullish(n) ? null : String(s).slice(0, Number(n)))],
  [
    'RIGHT',
    2,
    (s, n) => {
      if (nullish(s) || nullish(n)) return null;
      const count = Number(n);
      return count <= 0 ? '' : String(s).slice(-count);
    },
  ],

  /* 1-based, and 0 for "not found" — SQL's convention, not JavaScript's. */
  [
    'LOCATE',
    2,
    (needle, haystack) =>
      nullish(needle) || nullish(haystack) ? null : String(haystack).indexOf(String(needle)) + 1,
  ],

  /* ---------------------------------------------------------------- date */

  /*
    MySQL's DATEDIFF is (later, earlier) and counts whole days. Note the
    argument order — it is the reverse of what most people guess, and getting
    it backwards is a sign error rather than an exception, so it is the kind of
    bug that reaches production. The dates are truncated to midnight first, so
    two timestamps on the same day are 0 apart rather than a fraction.
  */
  [
    'DATEDIFF',
    2,
    (a, b) => {
      const later = toDate(a);
      const earlier = toDate(b);
      if (!later || !earlier) return null;
      return Math.round((Date.parse(iso(later)) - Date.parse(iso(earlier))) / DAY_MS);
    },
  ],

  ['DATE_ADD', 2, (d, days) => shiftDays(d, days)],
  ['DATE_SUB', 2, (d, days) => shiftDays(d, days === null ? null : -Number(days))],
  ['ADDDATE', 2, (d, days) => shiftDays(d, days)],
  ['SUBDATE', 2, (d, days) => shiftDays(d, days === null ? null : -Number(days))],

  /*
    A deliberately small subset of DATE_FORMAT: the specifiers a prep problem
    actually uses. An unknown one is left as written rather than dropped, so a
    query using something unsupported produces visibly odd output instead of
    silently losing a field.
  */
  [
    'DATE_FORMAT',
    2,
    (value, format) => {
      const d = toDate(value);
      if (!d || nullish(format)) return null;
      const map = {
        '%Y': d.getUTCFullYear(),
        '%y': pad(d.getUTCFullYear() % 100),
        '%m': pad(d.getUTCMonth() + 1),
        '%c': d.getUTCMonth() + 1,
        '%d': pad(d.getUTCDate()),
        '%e': d.getUTCDate(),
        '%H': pad(d.getUTCHours()),
        '%i': pad(d.getUTCMinutes()),
        '%s': pad(d.getUTCSeconds()),
      };
      return String(format).replace(/%[A-Za-z]/g, (token) =>
        token in map ? String(map[token]) : token,
      );
    },
  ],

  /* -------------------------------------------------------------- number */

  /*
    MySQL's TRUNCATE(n, d) chops rather than rounds, and it is not SQLite's
    TRUNCATE (which is a table statement, not a function) — so this name is
    free to take.
  */
  [
    'TRUNCATE',
    2,
    (n, digits) => {
      if (nullish(n) || nullish(digits)) return null;
      const factor = 10 ** Number(digits);
      return Math.trunc(Number(n) * factor) / factor;
    },
  ],
];

function shiftDays(value, days) {
  const d = toDate(value);
  if (!d || nullish(days)) return null;
  return iso(new Date(d.getTime() + Number(days) * DAY_MS));
}

/**
 * Registers every shim on an open database.
 *
 * Called once per database, immediately after the schema is built and before
 * anything runs — including inside the seed verifier, so a reference solution
 * is checked against exactly the functions the reader will have.
 */
export function registerShims(db) {
  /*
    ---------------------------------------------------------------------------
    One arity per name, and the guard below is not defensive programming.

    sql.js keys its function table by **name alone**. Registering the same name
    twice frees the first wrapper's pointer and leaves SQLite still holding it
    for the old arity — so a call at that arity reaches freed memory and returns
    a garbage value rather than erroring. An earlier version of this file
    registered `CONCAT` at four arities to emulate a variadic function, and the
    symptom was `CONCAT(name, ' (', id, ')')` quietly returning NULL. Nothing
    threw, nothing logged, and the query looked correct.

    So: one arity per name, enforced here, failing loudly at startup rather than
    subtly at query time. Genuinely variadic functions are not shimmed at all —
    SQLite's own `concat` and `concat_ws` are variadic and native.
    ---------------------------------------------------------------------------
  */
  const seen = new Set();

  for (const [name, arity, fn] of FUNCTIONS) {
    if (seen.has(name)) {
      throw new Error(
        `shims.js registers "${name}" more than once. sql.js keys functions by name, ` +
          'so the second registration frees the first and calls at the old arity read freed ' +
          'memory. Use one arity per name.',
      );
    }
    seen.add(name);

    /*
      sql.js reads the arity off the function it is handed, so each wrapper's
      declared parameter count has to match the number in the table. Building
      the wrapper from that number keeps the two impossible to get out of step.
    */
    db.create_function(name, makeArity(arity, fn));
  }
  return db;
}

/** Every arity the table above uses. Adding one means adding a line here. */
const ARITY = {
  1: (fn) => (a) => fn(a),
  2: (fn) => (a, b) => fn(a, b),
  3: (fn) => (a, b, c) => fn(a, b, c),
};

function makeArity(n, fn) {
  const wrap = ARITY[n];
  if (!wrap) throw new Error(`No wrapper for arity ${n} — add one to ARITY in shims.js`);
  return wrap(fn);
}

/** The names registered, for the docs and for a "what is available" panel. */
export const SHIMMED = [...new Set(FUNCTIONS.map(([name]) => name))].sort();
