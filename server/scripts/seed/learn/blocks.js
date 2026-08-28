/**
 * Tiny constructors for Learn blocks.
 *
 * The same shapes `GuideBlocks` already renders, so the Learn track needed no
 * second renderer — only a second place to author them. Twenty-eight topics
 * written as raw object literals would be mostly punctuation, and these keep the
 * content files readable enough to actually edit.
 *
 * Deliberately a separate file from `server/scripts/seed/guides/blocks.js`
 * rather than an import of it. That one is a seed-script dependency living under
 * `server/`, and the client build has no business reaching across the repo to
 * pull it into the browser bundle — the two are twins, not one module in two
 * places, exactly as `blockKinds.js` and the old `blockTypes.js` were.
 *
 * Prose fields accept `inline` markers — `` `code` ``, `**bold**`, `_italic_` —
 * and the content here leans on the first one heavily.
 */

export const h = (text) => ({ type: 'heading', text });

export const p = (text) => ({ type: 'paragraph', text });

export const ul = (...items) => ({ type: 'bullets', items: items.flat() });

/**
 * The order the variants appear here is the order of the tabs, and the first is
 * what the reader sees before touching anything.
 */
export const code = (...variants) => ({
  type: 'code',
  variants: variants.flat().filter(Boolean),
});

/*
  `lang` is what the highlighter switches on, so it has to be one of the names
  `JS_LANGS` knows. `label` is only ever the tab caption.
*/
export const jsx = (source, label = 'JSX') => ({ lang: 'jsx', label, code: source.trim() });
export const js = (source, label = 'JS') => ({ lang: 'js', label, code: source.trim() });
export const ts = (source, label = 'TS') => ({ lang: 'ts', label, code: source.trim() });

/**
 * Shell commands. `sh` is deliberately not a name `JS_LANGS` knows, so the
 * highlighter falls through to its neutral scan rather than colouring `install`
 * as an identifier and `npm` as a call — a command list reads better plain.
 */
export const sh = (source, label = 'Terminal') => ({ lang: 'sh', label, code: source.trim() });

/*
  Java, for the Complexity track.

  `highlight()` keeps two scans and picks between them by name: the JS family
  for anything in `JS_LANGS`, and the C family — Java and C++ keywords, the
  container types, no template literals — for everything else. `java` is not in
  `JS_LANGS`, so it lands on the C scan, which is the one written for it and the
  one the pattern guides have always used. A `cpp` twin is one line away if a
  topic ever wants a third tab; it is not written until one does.

  The `lang` string matches `SOLUTION_LANGS` in components/problem/attempts.js,
  so a snippet here and a stored solution are labelled the same thing.
*/
export const java = (source, label = 'Java') => ({ lang: 'java', label, code: source.trim() });

/*
  SQL, for the DBMS track.

  Three constructors and one `lang`, because the dialect is a *label* and never a
  different scan: `highlight()` has one SQL keyword set and MySQL, PostgreSQL and
  SQLite share more than 95% of it. What the separate names buy is the tab strip
  — `code(mysql(...), postgres(...))` is how a topic shows a dialect difference
  without writing the same query twice in prose, and the track is MySQL-first, so
  `mysql` is the one that goes on the left.

  Plain `sql` is for the majority of snippets, which are standard enough that
  naming a vendor on the tab would imply a difference that is not there.
*/
export const sql = (source, label = 'SQL') => ({ lang: 'sql', label, code: source.trim() });
export const mysql = (source, label = 'MySQL') => ({ lang: 'sql', label, code: source.trim() });
export const postgres = (source, label = 'PostgreSQL') => ({
  lang: 'sql',
  label,
  code: source.trim(),
});

export const table = (columns, rows, caption = '') => ({ type: 'table', columns, rows, caption });

/**
 * The signature table every API topic opens with. It is `table` with the header
 * row filled in, because writing `['Parameter', 'Type', 'What it does']` at the
 * top of twenty files is how the fourth one ends up saying something else.
 */
export const sig = (rows) => table(['Parameter', 'Type', 'What it does'], rows);

/** The "when do I reach for this" table every topic closes with. */
export const cheat = (rows) => table(['Want to', 'Reach for'], rows);

/*
  The two tables a SQL topic is really made of.

  A page about `LEFT JOIN` is three grids in a row — here are the tables, here is
  the query, here is what came back — and three anonymous grids is a page the
  reader has to count their way through. So both of these are captioned, and the
  caption is doing real work: on `data` it is the table's actual name, the one
  the `FROM` clause below it uses, and on `result` it says that this grid is an
  answer rather than more input.

  `variant` is what the stylesheet switches on. A sample table is drawn as data
  you are being handed; a result is drawn as data the query produced, with the
  hue's edge on it. Same block type either way — `GuideBlocks` renders one table.
*/
export const data = (caption, columns, rows) => ({
  type: 'table',
  variant: 'data',
  caption,
  columns,
  rows,
});

export const result = (columns, rows, caption = 'Result') => ({
  type: 'table',
  variant: 'result',
  caption,
  columns,
  rows,
});

/**
 * The interview table the Node topics close with, for the same reason `sig` and
 * `cheat` exist. Answers are one line on purpose: the table is a check that you
 * can say the thing out loud, not a second copy of the prose above it.
 */
export const asked = (rows) => table(['Asked in interviews', 'The answer in one line'], rows);

export const note = (text) => ({ type: 'callout', tone: 'note', text });
export const tip = (text) => ({ type: 'callout', tone: 'tip', text });
export const warn = (text) => ({ type: 'callout', tone: 'warn', text });

export const links = (...entries) => ({ type: 'links', links: entries.flat() });

/** Derives the muted source suffix from the URL so no one has to type it twice. */
export const link = (label, url) => ({
  label,
  url,
  source: (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  })(),
});

/**
 * The canonical react.dev page for an API, since every topic ends with one and
 * the URLs are all the same shape.
 */
export const reactDoc = (path, label) => link(label, `https://react.dev/${path}`);

/** The same, for the Node API reference — `nodeDoc('fs.html', 'fs')`. */
export const nodeDoc = (path, label) => link(label, `https://nodejs.org/api/${path}`);

/**
 * MDN, for the topics that are about the language rather than the runtime.
 * `mdn('Web/JavaScript/Closures', 'Closures')`.
 */
export const mdn = (path, label) =>
  link(label, `https://developer.mozilla.org/en-US/docs/${path}`);

/**
 * Wikipedia, for the Complexity track. The other three tracks close on a vendor
 * doc because they are about somebody's API; this one is about mathematics that
 * has no vendor, and the encyclopedia article is the closest thing to a
 * canonical page a topic like `Big O notation` has.
 *
 * The SQL track uses it too, and for the same reason: `Third normal form` and
 * `Two-phase locking` are not MySQL's and not PostgreSQL's.
 */
export const wiki = (path, label) => link(label, `https://en.wikipedia.org/wiki/${path}`);

/**
 * The MySQL manual — `mysqlDoc('join.html', 'JOIN')`.
 *
 * Pinned to 8.4, the current LTS, rather than to `/refman/en/`: an unversioned
 * URL silently becomes a page about a different release, and a note that links
 * to "whatever is current in three years" is a note that will one day be wrong
 * without anyone editing it.
 */
export const mysqlDoc = (path, label) =>
  link(label, `https://dev.mysql.com/doc/refman/8.4/en/${path}`);

/**
 * The PostgreSQL manual — `pgDoc('sql-select.html', 'SELECT')`.
 *
 * `/docs/current/` here, unlike MySQL above, because that is the URL Postgres
 * itself publishes and versioned ones redirect to it anyway.
 */
export const pgDoc = (path, label) =>
  link(label, `https://www.postgresql.org/docs/current/${path}`);
