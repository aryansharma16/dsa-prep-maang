/**
 * The derived half of a Learn topic — plaintext, word count, reading time.
 *
 * One function, called by the seeder and by any future admin save, so there is a
 * single place that can forget to recompute rather than two places that can
 * disagree. A topic whose `wordCount` says 1,400 and whose blocks say 300 is a
 * worse bug than one with no count at all, because the number is believed.
 */

/** Words per minute. Deliberately unhurried — this is reference prose, not a feed. */
const WPM = 220;

/**
 * Inline markers are stripped, not rendered.
 *
 * Prose here carries `` `code` ``, `**bold**` and `*emphasis*`, and a reader
 * searching for "useMemo" should match a sentence that wrote it as `` `useMemo` ``.
 * Underscore is not a marker in this app's inline syntax and is not treated as
 * one here either — half the pattern-guide prose is about C++, where
 * `lower_bound` is an identifier and not two markers around a word.
 */
const stripInline = (text) => String(text || '').replace(/[`*]/g, '');

/**
 * Everything a human reads, as one string.
 *
 * Code is excluded, and that is the whole judgement in this file. A `SELECT` in
 * every SQL topic and a `const` in every Node one would make the corpus look
 * uniform to a search and make every reading estimate a lie — nobody reads a
 * forty-line snippet at 220 words a minute. Headings, prose, bullets, callouts,
 * table cells and link labels are text; a code block is a figure.
 */
export function toPlaintext(blocks = []) {
  const out = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
      case 'paragraph':
      case 'callout':
        out.push(stripInline(block.text));
        break;
      case 'bullets':
        out.push(...(block.items || []).map(stripInline));
        break;
      case 'table':
        // The caption is the grid's name and belongs in the text; a reader
        // searching "employees" is looking for the table called employees.
        if (block.caption) out.push(stripInline(block.caption));
        out.push(...(block.columns || []).map(stripInline));
        out.push(...(block.rows || []).flat().map(stripInline));
        break;
      case 'links':
        out.push(...(block.links || []).map((l) => stripInline(l.label)));
        break;
      case 'image':
      case 'video':
        // The caption only — a URL or a YouTube id is not prose.
        if (block.text) out.push(stripInline(block.text));
        break;
      default:
        // `code`, and anything a later schema adds. Silence is correct: a new
        // block type should not quietly start counting toward reading time.
        break;
    }
  }

  return out.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * `{ plaintext, wordCount, readingMinutes }` for one topic's blocks.
 *
 * `readingMinutes` floors at 1: a two-sentence topic still takes a moment, and
 * "0 min" on a card reads as missing data rather than as a short page.
 */
export function summarise(blocks = []) {
  const plaintext = toPlaintext(blocks);
  const wordCount = plaintext ? plaintext.split(' ').filter(Boolean).length : 0;

  return {
    plaintext,
    wordCount,
    readingMinutes: wordCount ? Math.max(1, Math.round(wordCount / WPM)) : 0,
  };
}
