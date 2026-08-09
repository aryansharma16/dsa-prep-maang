/**
 * Just enough markdown for what a tutor writes back.
 *
 * Hand-rolled rather than a library, and the reason is not only the app's
 * four-dependency posture. A reply that is still arriving is *half* a document:
 * the common state of a streaming answer is an unterminated code fence, and it
 * has to render as a code block from the first backtick rather than as three
 * stray characters that suddenly become a block a second later. A parser that
 * only handles complete documents cannot do that; `open` below is the whole
 * point of owning this.
 *
 * Output is a block list. Turning it into elements is ChatMarkdown's job, so
 * nothing here can produce HTML and nothing downstream needs innerHTML.
 */

const FENCE = /^ {0,3}```/;
const BULLET = /^\s{0,3}[-*+]\s+/;
const NUMBER = /^\s{0,3}\d+[.)]\s+/;
const HEADING = /^ {0,3}(#{1,4})\s+(.*)$/;
const QUOTE = /^ {0,3}>\s?/;
const RULE = /^ {0,3}(-{3,}|\*{3,}|_{3,})\s*$/;

export function parseMarkdown(source = '') {
  const lines = String(source).split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (FENCE.test(line)) {
      const lang = line.replace(FENCE, '').trim().toLowerCase();
      const code = [];
      let closed = false;
      i += 1;
      while (i < lines.length) {
        if (FENCE.test(lines[i])) {
          closed = true;
          i += 1;
          break;
        }
        code.push(lines[i]);
        i += 1;
      }
      blocks.push({ type: 'code', lang, code: code.join('\n'), open: !closed });
      continue;
    }

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      i += 1;
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    if (BULLET.test(line) || NUMBER.test(line)) {
      const ordered = NUMBER.test(line);
      const marker = ordered ? NUMBER : BULLET;
      const items = [];
      while (i < lines.length && marker.test(lines[i])) {
        items.push(lines[i].replace(marker, ''));
        i += 1;
        // A wrapped item keeps going; only a blank line, the next item or a
        // fence ends it.
        while (
          i < lines.length &&
          lines[i].trim() &&
          !BULLET.test(lines[i]) &&
          !NUMBER.test(lines[i]) &&
          !FENCE.test(lines[i])
        ) {
          items[items.length - 1] += ` ${lines[i].trim()}`;
          i += 1;
        }
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    if (QUOTE.test(line)) {
      const quote = [];
      while (i < lines.length && QUOTE.test(lines[i])) {
        quote.push(lines[i].replace(QUOTE, ''));
        i += 1;
      }
      blocks.push({ type: 'quote', text: quote.join(' ') });
      continue;
    }

    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !FENCE.test(lines[i]) &&
      !BULLET.test(lines[i]) &&
      !NUMBER.test(lines[i]) &&
      !HEADING.test(lines[i]) &&
      !QUOTE.test(lines[i])
    ) {
      para.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: 'paragraph', text: para.join(' ') });
  }

  return blocks;
}

/**
 * Inline spans, in precedence order: code wins over everything, so `**` inside
 * a code span stays literal.
 */
export const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*|_[^_\n]+_)|(\[[^\]\n]*\]\([^)\s]+\))/g;

/**
 * There is no innerHTML anywhere in this renderer, so a link's href is the only
 * place a model could hand us something executable. http(s) only — that rules
 * out `javascript:` and `data:` without needing a list of what to block.
 */
export const safeHref = (href) => /^https?:\/\//i.test(href);
