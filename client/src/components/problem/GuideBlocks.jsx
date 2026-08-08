import { useState } from 'react';
import { IconCheck, IconCopy, IconExternal } from '../ui/Icons.jsx';
import { highlight } from './highlight.js';

/**
 * Renders a guide's typed blocks.
 *
 * Every block is a React element built from structured data — nothing here goes
 * through dangerouslySetInnerHTML, so the guide content never depends on the
 * regex sanitizer that guards the LeetCode statement.
 */

/**
 * A code block with more than one language becomes a tab strip. Six stacked
 * code walls is what a deep guide looks like without this — the reader wants
 * their language, not both.
 */
function CodeBlock({ variants }) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  if (!variants?.length) return null;

  const current = variants[Math.min(active, variants.length - 1)];
  const lines = highlight(current.code);

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

function Block({ block }) {
  switch (block.type) {
    case 'heading':
      return <h3 className="guide-h">{block.text}</h3>;

    case 'paragraph':
      return <p>{block.text}</p>;

    case 'bullets':
      return (
        <ul>
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );

    case 'code':
      return <CodeBlock variants={block.variants} />;

    case 'callout':
      return <div className={`guide-callout ${block.tone || 'note'}`}>{block.text}</div>;

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
                    <td key={j}>{cell}</td>
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
      // crashing the drawer.
      return null;
  }
}

export function GuideBlocks({ blocks = [] }) {
  return (
    <div className="guide-body">
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
}
