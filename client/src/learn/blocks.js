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

export const table = (columns, rows) => ({ type: 'table', columns, rows });

/**
 * The signature table every API topic opens with. It is `table` with the header
 * row filled in, because writing `['Parameter', 'Type', 'What it does']` at the
 * top of twenty files is how the fourth one ends up saying something else.
 */
export const sig = (rows) => table(['Parameter', 'Type', 'What it does'], rows);

/** The "when do I reach for this" table every topic closes with. */
export const cheat = (rows) => table(['Want to', 'Reach for'], rows);

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
