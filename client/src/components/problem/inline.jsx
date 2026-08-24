/**
 * Markdown-lite for the inside of a sentence: `code`, **bold**, *italic*.
 *
 * The typed blocks handle structure — a paragraph is a paragraph, a list is a
 * list — so there is nothing here about headings, fences or links. What was
 * missing is the span level, and it stops being optional the moment prose is
 * about an API: a page explaining useEffect that cannot render `useEffect` as
 * code is a wall of undifferentiated words.
 *
 * Returns React elements, never a string of HTML. That is what keeps the
 * promise `GuideBlocks` makes at the top of its own file — no guide or Learn
 * content ever reaches `dangerouslySetInnerHTML`, so none of it depends on a
 * sanitizer being correct.
 *
 * Emphasis nests one useful way round: the body of a bold or italic run is
 * scanned again, so `**a `key` prop**` gives a bold run with real inline code
 * inside it. That combination is unavoidable in prose about an API — half the
 * bullet points here are a bold claim about a named thing — and rendering the
 * backticks literally looked like a bug every time.
 *
 * Code spans are the floor and are never rescanned, so a marker inside one
 * stays literal. Recursion terminates because each body is strictly shorter
 * than the match it came from.
 */

/*
  Order is load-bearing twice over. Backticks come first, so asterisks inside a
  code span stay literal. `**` comes before `*`, so a bold run is not read as an
  empty italic followed by stray text.

  Each emphasis marker has to hug a non-space character on both sides, which is
  the rule markdown itself uses and the reason `2 * 3 * 4` survives as
  arithmetic instead of turning into an italic 3. Written out with a
  non-capturing inner group rather than a lookbehind: lookbehind is a *parse*
  error in older Safari, and a regex that fails to parse takes the whole bundle
  down rather than just this line of prose.

  Underscore is deliberately not an emphasis marker here, unlike in markdown.
  Half the prose in the pattern guides is about C++, and `lower_bound ... and
  upper_bound` in one sentence is two underscores hugging non-space — which
  markdown rules would happily read as an italic run through the middle of two
  identifiers. Asterisks do not appear in identifiers, so they are safe and
  they are enough.
*/
const EMPHASIS = (mark) => `${mark}[^\\s${mark}](?:[^${mark}]*[^\\s${mark}])?${mark}`;

const INLINE_RE = new RegExp(
  [
    '(`[^`]+`)', // 1 code
    `(${EMPHASIS('\\*\\*')})`, // 2 bold
    `(${EMPHASIS('\\*')})`, // 3 italic
  ].join('|'),
  'g',
);

/**
 * `text` -> an array of strings and elements, ready to drop into JSX.
 *
 * Anything that is not a string comes back untouched, so a block whose field is
 * already an element (or is null) passes straight through.
 */
export function inline(text) {
  if (typeof text !== 'string') return text;
  if (!text) return text;
  // The overwhelmingly common case in the existing pattern guides, which
  // contain no markers at all. Worth skipping the scan and the array.
  if (!/[`*]/.test(text)) return text;

  const out = [];
  let last = 0;
  let match;
  let key = 0;

  INLINE_RE.lastIndex = 0;
  while ((match = INLINE_RE.exec(text)) !== null) {
    /*
      Read the cursor out before doing anything else. INLINE_RE lives at module
      scope and carries `lastIndex`, and the recursive calls below run their own
      scan against it — so by the time they return, the shared cursor points
      into the nested string, not this one. Captured here and written back at
      the end of the iteration, the regex can be reused without allocating one
      per call.
    */
    const end = INLINE_RE.lastIndex;

    if (match.index > last) out.push(text.slice(last, match.index));

    const [whole, code, bold] = match;
    // Strip the markers: two characters each side for bold, one for the rest.
    const width = bold ? 2 : 1;
    const body = whole.slice(width, -width);

    // Bare elements, no class of their own: `.guide-body p code` and
    // `.guide-table code` already style inline code, and a second hook would be
    // one more thing to keep in step with them.
    if (code) out.push(<code key={(key += 1)}>{body}</code>);
    else if (bold) out.push(<strong key={(key += 1)}>{inline(body)}</strong>);
    else out.push(<em key={(key += 1)}>{inline(body)}</em>);

    last = end;
    INLINE_RE.lastIndex = end;
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}
