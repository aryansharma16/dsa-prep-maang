import { memo, useMemo, useState } from 'react';
import { IconCheck, IconCopy, IconExternal } from '../ui/Icons.jsx';
import { highlight } from './highlight.js';
import { inline } from './inline.jsx';

/**
 * Renders a guide's typed blocks. Shared by the pattern guides and the Learn
 * track, which author the same shapes from two different places.
 *
 * Every block is a React element built from structured data — nothing here goes
 * through dangerouslySetInnerHTML, so the guide content never depends on the
 * regex sanitizer that guards the LeetCode statement. `inline` keeps that true
 * at the span level too: it returns elements, not markup.
 */

/**
 * A code block with more than one language becomes a tab strip. Six stacked
 * code walls is what a deep guide looks like without this — the reader wants
 * their language, not both.
 */
function CodeBlock({ variants }) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);

  const current = variants?.[Math.min(active, variants.length - 1)];
  // Tokenising is the expensive part of rendering a guide, and the source never
  // changes — only which tab is showing. The lang picks the keyword set: the
  // guides are Java and C++, the Learn track is JS and JSX.
  const lines = useMemo(
    () => (current ? highlight(current.code, current.lang) : []),
    [current],
  );

  if (!variants?.length) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(current.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard needs a secure context and permission. Nothing useful to say
      // if it is refused — the code is right there to select.
    }
  };

  return (
    <div className="guide-code">
      <div className="guide-code-tabs" role="tablist">
        {variants.map((variant, i) => (
          <button
            key={variant.lang + i}
            type="button"
            role="tab"
            aria-selected={i === active}
            className={i === active ? 'on' : ''}
            // A single-language block still renders its tab, as a label — it
            // keeps every code block the same shape down the page.
            onClick={() => setActive(i)}
          >
            {variant.label || variant.lang}
          </button>
        ))}
        <button type="button" className="guide-copy" onClick={copy} aria-label="Copy code">
          {copied ? <IconCheck size={11} /> : <IconCopy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <pre>
        {/* One element per line so the gutter number is generated content —
            it cannot end up in what you copy. */}
        <code>
          {lines.map((tokens, i) => (
            <span className="cl" key={i}>
              {tokens.map((token, j) =>
                token.c ? (
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

const CALLOUT = { tip: 'Tip', warn: 'Watch out', note: 'Note' };

/**
 * The anchor a heading gets, and the one the table of contents jumps to. The
 * block index is part of it so two sections that happen to share a title still
 * scroll to different places, and it is derived rather than stored so a guide
 * edited on the server needs no migration.
 */
export const headingId = (text, index) =>
  `guide-${index}-${String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`;

/** The headings of a guide, in order — what the reader's side nav is built from. */
export function guideHeadings(blocks = []) {
  return blocks
    .map((block, i) =>
      block.type === 'heading' ? { id: headingId(block.text, i), text: block.text } : null,
    )
    .filter(Boolean);
}

function Block({ block, index }) {
  switch (block.type) {
    case 'heading':
      return (
        <h3 className="guide-h" id={headingId(block.text, index)}>
          {block.text}
        </h3>
      );

    case 'paragraph':
      return <p>{inline(block.text)}</p>;

    case 'bullets':
      return (
        <ul>
          {block.items.map((item, i) => (
            <li key={i}>{inline(item)}</li>
          ))}
        </ul>
      );

    case 'code':
      return <CodeBlock variants={block.variants} />;

    case 'callout': {
      // Labelled, because a bare tinted box asks the reader to decode the colour.
      const tone = CALLOUT[block.tone] ? block.tone : 'note';
      return (
        <aside className={`guide-callout ${tone}`}>
          <span className="guide-callout-tag">{CALLOUT[tone]}</span>
          <p>{inline(block.text)}</p>
        </aside>
      );
    }

    case 'table':
      return (
        <div className="guide-tablewrap">
          <table className="guide-table">
            <thead>
              <tr>
                {block.columns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{inline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'image':
      return (
        <figure className="guide-figure">
          <img src={block.url} alt={block.text || ''} loading="lazy" />
          {block.text && <figcaption>{block.text}</figcaption>}
        </figure>
      );

    case 'video':
      // youtube-nocookie so reading a guide does not seed ad tracking, and lazy
      // so a guide with a video below the fold costs nothing until scrolled to.
      return (
        <div className="guide-video">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${block.videoId}`}
            title={block.text || 'Walkthrough'}
            loading="lazy"
            allowFullScreen
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
      );

    case 'links':
      return (
        <ul className="guide-links">
          {block.links.map((entry) => (
            <li key={entry.url}>
              <a href={entry.url} target="_blank" rel="noreferrer">
                {entry.label}
                <IconExternal size={11} />
              </a>
              {entry.source && <span className="guide-link-src">{entry.source}</span>}
            </li>
          ))}
        </ul>
      );

    default:
      // A block type the server knows and this build does not. Skipping beats
      // crashing the reader.
      return null;
  }
}

/*
  Memoised, and worth it here: the reader re-renders on every scroll frame to
  move its progress bar and side-rail marker, while `blocks` comes off a cache
  and never changes for the life of the guide.
*/
export const GuideBlocks = memo(function GuideBlocks({ blocks = [] }) {
  return (
    <div className="guide-body">
      {blocks.map((block, i) => (
        <Block key={i} block={block} index={i} />
      ))}
    </div>
  );
});
