import { Fragment } from 'react';
import { IconExternal } from '../ui/Icons.jsx';

/**
 * Markdown-lite, for the inside of a line.
 *
 * The server stores block text as plain text and never interprets it — see the
 * header of `server/src/models/Note.js`. Emphasis has to happen somewhere, and
 * this is the somewhere: a tiny tokeniser producing React elements.
 *
 * It is not a Markdown parser and must not grow into one. Four marks, no
 * nesting, no HTML passthrough. The whole safety argument for this module is
 * that nothing ever reaches `dangerouslySetInnerHTML`, and every feature that
 * would need it — tables inside a paragraph, raw spans, images inline — is a
 * block type instead.
 *
 * The alternative was offset-based spans (`{start, end, mark}`) stored per
 * paragraph. They are more precise and they corrupt the first time text is
 * edited without recomputing every offset behind the edit. Text that carries its
 * own markers cannot drift out of sync with itself.
 */

/*
  One pass, alternation ordered longest-first so `**bold**` is not eaten by the
  italic rule. Code is matched before everything else because backticks are how
  you quote a literal asterisk.
*/
const TOKEN = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(_[^_\n]+_)|(\[[^\]\n]+\]\([^)\s]+\))/g;

/** Same allowlist the server enforces — an href is the one place text executes. */
const SAFE = /^(https?:|mailto:)/i;

const safeHref = (url) => (SAFE.test(String(url).trim()) ? String(url).trim() : null);

/**
 * `text` → an array of strings and elements, ready to drop into JSX.
 *
 * Returns the input untouched when nothing matches, which is the common case and
 * costs one regex rather than an array of one.
 */
export function inline(text) {
  const value = String(text ?? '');
  if (!value || !/[`*_[]/.test(value)) return value;

  const out = [];
  let last = 0;
  let match;

  TOKEN.lastIndex = 0;
  while ((match = TOKEN.exec(value)) !== null) {
    if (match.index > last) out.push(value.slice(last, match.index));
    const [raw, code, bold, italic, link] = match;

    if (code) {
      out.push(<code key={out.length}>{code.slice(1, -1)}</code>);
    } else if (bold) {
      out.push(<strong key={out.length}>{bold.slice(2, -2)}</strong>);
    } else if (italic) {
      out.push(<em key={out.length}>{italic.slice(1, -1)}</em>);
    } else if (link) {
      const split = link.indexOf('](');
      const label = link.slice(1, split);
      const href = safeHref(link.slice(split + 2, -1));
      // An unsafe scheme renders as its own label rather than vanishing — the
      // reader should see that something was written there.
      out.push(
        href ? (
          <a key={out.length} href={href} target="_blank" rel="noreferrer noopener">
            {label}
            <IconExternal size={10} />
          </a>
        ) : (
          <Fragment key={out.length}>{label}</Fragment>
        ),
      );
    }
    last = match.index + raw.length;
  }

  if (last < value.length) out.push(value.slice(last));
  return out;
}

/** Blank lines become paragraph breaks; single newlines stay soft. */
export const paragraphs = (text) =>
  String(text ?? '')
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
