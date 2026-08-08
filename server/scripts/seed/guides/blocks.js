/**
 * Tiny constructors for guide blocks.
 *
 * Twenty-two guides written as raw object literals would be mostly punctuation —
 * `{ type: 'paragraph', text: '...' }` repeated a few hundred times. These keep
 * the content files readable enough to actually edit, and they are the one place
 * a block's shape is spelled out, so a typo in a content file fails here rather
 * than silently seeding a block the renderer ignores.
 */

export const h = (text) => ({ type: 'heading', text });

export const p = (text) => ({ type: 'paragraph', text });

export const ul = (...items) => ({ type: 'bullets', items: items.flat() });

/**
 * Java first, C++ second — the order they appear here is the order of the tabs,
 * and the first is what the reader sees before touching anything.
 */
export const code = (...variants) => ({
  type: 'code',
  variants: variants.flat().filter(Boolean),
});

export const java = (code, label = 'Java') => ({ lang: 'java', label, code: code.trim() });
export const cpp = (code, label = 'C++') => ({ lang: 'cpp', label, code: code.trim() });

export const table = (columns, rows) => ({ type: 'table', columns, rows });

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
