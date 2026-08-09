import { useMemo, useState } from 'react';
import { highlight } from '../problem/highlight.js';
import { IconCheck, IconCopy } from '../ui/Icons.jsx';
import { INLINE, parseMarkdown, safeHref } from './markdown.js';

/**
 * A model reply, as elements.
 *
 * Code blocks emit the guide reader's exact DOM — `.guide-code`, the tab strip,
 * `.guide-copy`, and one `.cl` span per line. That is deliberate reuse rather
 * than a coincidence: it brings the sticky line-number gutter, every `.tok-*`
 * syntax colour in both themes, and the copy button along with it, for no new
 * CSS. Generalising GuideBlocks' own CodeBlock would have meant reshaping a
 * memoised component the guide reader depends on, to gain nothing.
 */

function inline(text) {
  const out = [];
  let last = 0;
  let match;
  INLINE.lastIndex = 0;

  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const [raw, code, bold, em, link] = match;
    const key = `s${match.index}`;

    if (code) out.push(<code key={key}>{raw.slice(1, -1)}</code>);
    else if (bold) out.push(<strong key={key}>{raw.slice(2, -2)}</strong>);
    else if (em) out.push(<em key={key}>{raw.slice(1, -1)}</em>);
    else {
      const cut = link.indexOf('](');
      const label = link.slice(1, cut);
      const href = link.slice(cut + 2, -1);
      out.push(
        safeHref(href) ? (
          <a key={key} href={href} target="_blank" rel="noreferrer noopener">
            {label || href}
          </a>
        ) : (
          label || href
        ),
      );
    }
    last = INLINE.lastIndex;
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}

function ChatCode({ lang, code, open }) {
  const [copied, setCopied] = useState(false);

  /*
    Do not tokenise a fence that is still open. An unterminated string literal
    paints everything after it as a string until the closing quote arrives, so a
    block being typed would flicker between colours — which reads as broken
    rendering rather than as text still arriving.
  */
  const lines = useMemo(() => (open ? null : highlight(code)), [code, open]);
  const plain = useMemo(() => (open ? code.split('\n').map((l) => [{ t: l, c: '' }]) : null), [code, open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard needs a secure context and permission. The code is on screen
      // to select if it is refused.
    }
  };

  return (
    <div className="guide-code chat-code">
      <div className="guide-code-tabs">
        <span className="chat-code-lang">{lang || 'code'}</span>
        {!open && (
          <button type="button" className="guide-copy" onClick={copy} aria-label="Copy code">
            {copied ? <IconCheck size={11} /> : <IconCopy size={11} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
      <pre>
        <code>
          {(lines || plain).map((tokens, i) => (
            // eslint-disable-next-line react/no-array-index-key -- lines have no id
            <span className="cl" key={i}>
              {tokens.map((token, j) =>
                token.c ? (
                  // eslint-disable-next-line react/no-array-index-key
                  <span className={token.c} key={j}>
                    {token.t}
                  </span>
                ) : (
                  token.t
                ),
              )}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

export function ChatMarkdown({ text, streaming = false }) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);

  return (
    <div className={`chat-md ${streaming ? 'streaming' : ''}`}>
      {blocks.map((block, i) => {
        const key = `b${i}`;
        if (block.type === 'code') return <ChatCode key={key} {...block} />;
        if (block.type === 'hr') return <hr key={key} />;
        if (block.type === 'quote') return <blockquote key={key}>{inline(block.text)}</blockquote>;
        if (block.type === 'heading') {
          // The prompt asks for no headings; if one arrives anyway it renders as
          // emphasised text rather than at display size inside a 350px dock.
          return (
            <p key={key} className="chat-md-h">
              <strong>{inline(block.text)}</strong>
            </p>
          );
        }
        if (block.type === 'list') {
          const List = block.ordered ? 'ol' : 'ul';
          return (
            <List key={key}>
              {block.items.map((item, j) => (
                // eslint-disable-next-line react/no-array-index-key
                <li key={j}>{inline(item)}</li>
              ))}
            </List>
          );
        }
        return <p key={key}>{inline(block.text)}</p>;
      })}
    </div>
  );
}
