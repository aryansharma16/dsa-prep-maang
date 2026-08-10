import { memo, useMemo, useState } from 'react';
import { highlight } from '../problem/highlight.js';
import {
  IconCheck,
  IconChevronRight,
  IconCopy,
  IconExternal,
  IconFile,
  IconUpload,
} from '../ui/Icons.jsx';
import { humanBytes } from './blockTypes.js';
import { inline, paragraphs } from './inline.jsx';

/**
 * Renders a note's blocks — the reader, and the editor's preview.
 *
 * One component for both, deliberately. A separate preview renderer is a
 * promise the editor cannot keep: the two drift, and the drift is only ever
 * discovered after publishing. What you see while writing is this, fed the same
 * payload that will be saved.
 *
 * Nothing here goes through `dangerouslySetInnerHTML`. Every block is an element
 * built from structured data, and the only free text that gets any
 * interpretation at all is the inline markdown-lite in `inline.jsx`, which
 * produces elements rather than markup.
 */

const CALLOUT = {
  note: 'Note',
  tip: 'Tip',
  warn: 'Watch out',
  danger: 'Careful',
  success: 'Worked',
};

/** The anchor a heading contributes to the contents rail. */
export const blockAnchor = (block, index) => `nb-${block.id || index}`;

function CodeBlock({ variants = [], caption }) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);

  const current = variants[Math.min(active, variants.length - 1)];
  // Tokenising is the expensive part of painting a note; the source never
  // changes, only which tab is showing.
  const lines = useMemo(() => (current ? highlight(current.code) : []), [current]);

  if (!variants.length) return null;

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
    <figure className="nr-code">
      <div className="nr-code-tabs" role="tablist">
        {variants.map((variant, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === active}
            className={i === active ? 'on' : ''}
            onClick={() => setActive(i)}
          >
            {variant.filename || variant.label || variant.lang || 'text'}
          </button>
        ))}
        <button type="button" className="nr-copy" onClick={copy} aria-label="Copy code">
          {copied ? <IconCheck size={11} /> : <IconCopy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <pre>
        {/* One element per line so the gutter number is generated content — it
            cannot end up in what you copy. */}
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
      {caption && <figcaption>{inline(caption)}</figcaption>}
    </figure>
  );
}

/**
 * A dropdown, as `<details>`.
 *
 * Native rather than a `useState` toggle, and the reason is worth keeping: this
 * is the one block whose content can be hidden, and browser find-in-page opens
 * a `<details>` to reveal a match inside it. A div that is conditionally
 * rendered makes the text inside a collapsed section unfindable — which is
 * exactly the text people collapse (a stack trace, a long config) and exactly
 * what they later come back searching for.
 */
function Dropdown({ block }) {
  return (
    <details className={`nr-drop ${block.tone ? `tone-${block.tone}` : ''}`} open={block.open}>
      <summary>
        <span className="nr-drop-chev">
          <IconChevronRight size={11} />
        </span>
        {inline(block.title)}
      </summary>
      <div className="nr-drop-body">
        {(block.children || []).map((child, i) => (
          <Block key={child.id || i} block={child} index={i} />
        ))}
      </div>
    </details>
  );
}

function Figure({ asset, caption, align = 'center', width = 'full' }) {
  if (!asset?.url) return null;
  return (
    <figure className={`nr-figure align-${align} w-${width}`}>
      <img
        src={asset.url}
        alt={caption || asset.name || ''}
        loading="lazy"
        // Reserving the box stops the page jumping as images arrive — the
        // dimensions are measured in the browser at upload for this one reason.
        width={asset.width || undefined}
        height={asset.height || undefined}
      />
      {caption && <figcaption>{inline(caption)}</figcaption>}
    </figure>
  );
}

/**
 * A PDF card, and an inline viewer behind a click.
 *
 * Not an always-on `<iframe>`: a note with four PDFs would fetch four documents
 * and hand four plugin instances to the browser before anyone asked to read
 * one. The card is the default, opening is the opt-in.
 */
function FileBlock({ block }) {
  const [open, setOpen] = useState(false);
  const { asset, title, caption } = block;
  if (!asset?.url) return null;

  const isPdf = asset.contentType === 'application/pdf';

  return (
    <div className="nr-file">
      <div className="nr-file-card">
        <span className="nr-file-icon">
          <IconFile size={16} />
        </span>
        <span className="nr-file-meta">
          <strong>{title || asset.name}</strong>
          <span>
            {isPdf ? 'PDF' : asset.contentType || 'File'} · {humanBytes(asset.bytes)}
          </span>
        </span>
        {isPdf && (
          <button type="button" className="btn ghost" onClick={() => setOpen((o) => !o)}>
            {open ? 'Hide' : 'Read here'}
          </button>
        )}
        <a className="btn ghost" href={asset.url} target="_blank" rel="noreferrer noopener">
          Open
          <IconExternal size={11} />
        </a>
      </div>
      {open && isPdf && (
        <div className="nr-file-view">
          <iframe src={asset.url} title={title || asset.name} loading="lazy" />
        </div>
      )}
      {caption && <p className="nr-caption">{inline(caption)}</p>}
    </div>
  );
}

const LIST_TAG = { numbered: 'ol' };

function List({ block }) {
  const variant = block.variant || 'bullet';
  const Tag = LIST_TAG[variant] || 'ul';

  return (
    <Tag className={`nr-list ${variant}`}>
      {(block.items || []).map((item, i) => (
        <li key={i} className={`d${item.depth || 0} ${item.checked ? 'done' : ''}`}>
          {variant === 'check' && (
            <span className="nr-check" aria-hidden="true">
              {item.checked ? <IconCheck size={10} /> : null}
            </span>
          )}
          <span>{inline(item.text)}</span>
        </li>
      ))}
    </Tag>
  );
}

function Block({ block, index }) {
  switch (block.type) {
    case 'heading': {
      const Tag = `h${Math.min(4, Math.max(2, block.level || 2))}`;
      return (
        <Tag className="nr-h" id={blockAnchor(block, index)} data-level={block.level || 2}>
          {inline(block.text)}
        </Tag>
      );
    }

    case 'paragraph':
      return (
        <>
          {paragraphs(block.text).map((chunk, i) => (
            <p key={i}>{inline(chunk)}</p>
          ))}
        </>
      );

    case 'list':
      return <List block={block} />;

    case 'callout': {
      const tone = CALLOUT[block.tone] ? block.tone : 'note';
      return (
        // Labelled, not merely tinted — a bare coloured box asks the reader to
        // decode the colour, and one of them is about to say "this will bite you".
        <aside className={`nr-callout ${tone}`}>
          <span className="nr-callout-tag">{block.title || CALLOUT[tone]}</span>
          {paragraphs(block.text).map((chunk, i) => (
            <p key={i}>{inline(chunk)}</p>
          ))}
        </aside>
      );
    }

    case 'quote':
      return (
        <blockquote className="nr-quote">
          <p>{inline(block.text)}</p>
          {block.cite && <cite>{block.cite}</cite>}
        </blockquote>
      );

    case 'code':
      return <CodeBlock variants={block.variants} caption={block.caption} />;

    case 'links':
      return (
        <ul className={`nr-links ${block.variant === 'list' ? 'as-list' : 'as-cards'}`}>
          {block.links.map((entry, i) => (
            <li key={i}>
              <a href={entry.url} target="_blank" rel="noreferrer noopener">
                <span className="nr-link-label">
                  {entry.label}
                  <IconExternal size={10} />
                </span>
                {entry.description && <span className="nr-link-desc">{entry.description}</span>}
                {entry.source && <span className="nr-link-src">{entry.source}</span>}
              </a>
            </li>
          ))}
        </ul>
      );

    case 'image':
      return (
        <Figure
          asset={block.asset}
          caption={block.caption}
          align={block.align}
          width={block.width}
        />
      );

    case 'gallery':
      return (
        <figure className={`nr-gallery w-${block.width || 'full'}`}>
          <div className="nr-gallery-grid" data-count={Math.min(4, block.assets?.length || 0)}>
            {(block.assets || []).map((asset, i) => (
              <a key={i} href={asset.url} target="_blank" rel="noreferrer noopener">
                <img src={asset.url} alt={asset.name || ''} loading="lazy" />
              </a>
            ))}
          </div>
          {block.caption && <figcaption>{inline(block.caption)}</figcaption>}
        </figure>
      );

    case 'file':
      return <FileBlock block={block} />;

    case 'video':
      // youtube-nocookie so reading a note does not seed ad tracking, and lazy
      // so one below the fold costs nothing until it is scrolled to.
      return (
        <figure className="nr-video">
          <div className="nr-video-frame">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${block.videoId}`}
              title={block.caption || 'Video'}
              loading="lazy"
              allowFullScreen
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          </div>
          {block.caption && <figcaption>{inline(block.caption)}</figcaption>}
        </figure>
      );

    case 'table':
      return (
        <figure className="nr-tablewrap">
          <table className="nr-table">
            <thead>
              <tr>
                {block.columns.map((col, i) => (
                  <th key={i}>{col}</th>
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
          {block.caption && <figcaption>{inline(block.caption)}</figcaption>}
        </figure>
      );

    case 'divider':
      return <hr className="nr-divider" />;

    case 'dropdown':
      return <Dropdown block={block} />;

    default:
      // A type the server knows and this build does not. Skipping beats
      // crashing the whole note.
      return null;
  }
}

/** The empty state of the preview, so a new note is not a blank rectangle. */
function Nothing() {
  return (
    <div className="nr-empty">
      <IconUpload size={18} />
      <p>Nothing here yet — add a block and it shows up as you type.</p>
    </div>
  );
}

export const NoteBlocks = memo(function NoteBlocks({ blocks = [] }) {
  if (!blocks.length) return <Nothing />;
  return (
    <div className="nr-body">
      {blocks.map((block, i) => (
        <Block key={block.id || i} block={block} index={i} />
      ))}
    </div>
  );
});

/** Headings, in order — what the contents rail is built from. */
export const noteHeadings = (blocks = []) =>
  blocks
    .map((block, i) =>
      block.type === 'heading' && block.text?.trim()
        ? { id: blockAnchor(block, i), text: block.text.trim(), level: block.level || 2 }
        : null,
    )
    .filter(Boolean);
