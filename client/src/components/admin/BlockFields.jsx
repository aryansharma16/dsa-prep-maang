import { IconClose, IconPlus } from '../ui/Icons.jsx';
import { deriveSource, extractVideoId, move, nextKey } from './blockKinds.js';
import { Dropdown } from '../ui/Dropdown.jsx';

// The languages a code variant can be tagged as. Lower case because that is
// what the highlighter keys off, and what the stored block carries.
const LANG_OPTIONS = ['java', 'cpp', 'python', 'javascript', 'text'].map((l) => ({
  value: l,
  label: l,
}));

/**
 * The per-type field forms. One switch, mirroring the one in GuideBlocks.jsx —
 * open the two side by side and every case lines up.
 *
 * `onChange` takes a patch, so a field never has to rebuild the whole block.
 */
export function BlockFields({ block, onChange }) {
  const patch = (changes) => onChange({ ...block, ...changes });

  switch (block.type) {
    case 'heading':
      return (
        <label className="field">
          <span>Heading</span>
          <input value={block.text} onChange={(e) => patch({ text: e.target.value })} />
        </label>
      );

    case 'paragraph':
      return (
        <label className="field">
          <span>Text</span>
          <textarea rows={4} value={block.text} onChange={(e) => patch({ text: e.target.value })} />
        </label>
      );

    case 'bullets':
      return <ItemList block={block} patch={patch} label="Bullets" noun="Bullet" />;

    /*
      A flow is `items` too, so it gets the same editor — down to Enter adding
      the next step and Backspace removing an empty one. The two differ in what
      the list means, which is the caption's job and the reader's stylesheet's,
      not this form's.
    */
    case 'flow':
      return (
        <>
          <ItemList block={block} patch={patch} label="Steps" noun="Step" />
          <label className="field">
            <span>Caption</span>
            <input
              value={block.caption || ''}
              onChange={(e) => patch({ caption: e.target.value })}
            />
            <span className="field-hint">
              Sits above the chips — &ldquo;Request path&rdquo;, or the rung on a scale ladder.
            </span>
          </label>
        </>
      );

    /*
      Art, so the textarea is monospace and does not wrap: a diagram reflowed to
      the width of a form field is no longer a diagram. Spellcheck off for the
      same reason — every box-drawing run would earn a red underline.
    */
    case 'diagram':
      return (
        <>
          <label className="field">
            <span>Diagram</span>
            <textarea
              className="gb-art"
              rows={12}
              spellCheck={false}
              wrap="off"
              value={block.text}
              onChange={(e) => patch({ text: e.target.value })}
            />
            <span className="field-hint">
              Drawn as a figure — no line numbers, no copy button. Leading blank lines are
              trimmed.
            </span>
          </label>
          <label className="field">
            <span>Caption</span>
            <input
              value={block.caption || ''}
              onChange={(e) => patch({ caption: e.target.value })}
            />
          </label>
        </>
      );

    case 'code':
      return <CodeFields block={block} patch={patch} />;

    case 'callout':
      return (
        <>
          <div className="field">
            <span>Tone</span>
            <div className="gb-tones">
              {['note', 'tip', 'warn'].map((tone) => (
                <button
                  key={tone}
                  type="button"
                  className={`toggle-chip ${block.tone === tone ? 'on' : ''}`}
                  onClick={() => patch({ tone })}
                >
                  {tone === 'warn' ? 'Watch out' : tone === 'tip' ? 'Tip' : 'Note'}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span>Text</span>
            <textarea rows={3} value={block.text} onChange={(e) => patch({ text: e.target.value })} />
          </label>
        </>
      );

    case 'table':
      return <TableFields block={block} patch={patch} />;

    case 'image':
      return (
        <>
          <label className="field">
            <span>Image URL</span>
            <input value={block.url} onChange={(e) => patch({ url: e.target.value })} />
          </label>
          <label className="field">
            <span>Caption</span>
            <input value={block.text} onChange={(e) => patch({ text: e.target.value })} />
            <span className="field-hint">Also used as the alt text.</span>
          </label>
        </>
      );

    case 'video':
      return (
        <>
          <label className="field">
            <span>YouTube video</span>
            <input
              value={block.videoId}
              placeholder="Paste the watch URL or the id"
              onChange={(e) => patch({ videoId: e.target.value })}
              // Extracted on blur rather than on every keystroke, so pasting a
              // URL and pasting an id both end up right without fighting the
              // cursor while you type.
              onBlur={(e) => patch({ videoId: extractVideoId(e.target.value) })}
            />
            <span className="field-hint">
              Stored as a bare id — a full URL here renders a blank player.
            </span>
          </label>
          <label className="field">
            <span>Title</span>
            <input value={block.text} onChange={(e) => patch({ text: e.target.value })} />
          </label>
        </>
      );

    case 'links':
      return (
        <div className="field">
          <span>Links</span>
          {block.links.map((link, i) => (
            <div className="gb-item gb-item-link" key={link._k}>
              <input
                value={link.label}
                placeholder="Label"
                onChange={(e) => {
                  const links = [...block.links];
                  links[i] = { ...link, label: e.target.value };
                  patch({ links });
                }}
              />
              <input
                value={link.url}
                placeholder="https://..."
                onChange={(e) => {
                  const links = [...block.links];
                  links[i] = { ...link, url: e.target.value };
                  patch({ links });
                }}
                onBlur={(e) => {
                  // Only fills an empty source, so a hand-written one is never
                  // clobbered.
                  if (link.source) return;
                  const links = [...block.links];
                  links[i] = { ...links[i], source: deriveSource(e.target.value) };
                  patch({ links });
                }}
              />
              <button
                type="button"
                className="icon-btn"
                aria-label="Remove link"
                onClick={() => patch({ links: block.links.filter((_, j) => j !== i) })}
              >
                <IconClose size={12} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="link-btn"
            onClick={() =>
              patch({ links: [...block.links, { label: '', url: '', source: '', _k: nextKey() }] })
            }
          >
            + Link
          </button>
        </div>
      );

    default:
      return <p className="hint">No editor for “{block.type}” blocks.</p>;
  }
}

/**
 * The `items` editor, shared by `bullets` and `flow`.
 *
 * Two block types write the same field, and the keyboard behaviour below is the
 * whole reason this is worth extracting rather than pasting: Enter adds the
 * next line and Backspace on an empty one removes it, so writing six bullets
 * costs no mouse trips at all. Duplicated, that is the kind of thing that gets
 * fixed in one copy.
 *
 * Keyed by index rather than by a `_k`, as the bullets editor always was —
 * these are bare strings with nowhere to hang a key, and a reorder control is
 * one of the things this form does not have.
 */
function ItemList({ block, patch, label, noun }) {
  return (
    <div className="field">
      <span>{label}</span>
      {block.items.map((item, i) => (
        <div className="gb-item" key={i}>
          <input
            value={item}
            onChange={(e) => {
              const items = [...block.items];
              items[i] = e.target.value;
              patch({ items });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const items = [...block.items];
                items.splice(i + 1, 0, '');
                patch({ items });
              }
              if (e.key === 'Backspace' && !item && block.items.length > 1) {
                e.preventDefault();
                patch({ items: block.items.filter((_, j) => j !== i) });
              }
            }}
          />
          <button
            type="button"
            className="icon-btn"
            aria-label={`Remove ${noun.toLowerCase()}`}
            onClick={() => patch({ items: block.items.filter((_, j) => j !== i) })}
          >
            <IconClose size={12} />
          </button>
        </div>
      ))}
      <button type="button" className="link-btn" onClick={() => patch({ items: [...block.items, ''] })}>
        + {noun}
      </button>
    </div>
  );
}

function CodeFields({ block, patch }) {
  const setVariant = (i, changes) => {
    const variants = [...block.variants];
    variants[i] = { ...variants[i], ...changes };
    patch({ variants });
  };

  return (
    <div className="field">
      <span>Code variants</span>
      <div className="gb-variants">
        {block.variants.map((variant, i) => (
          <span className="gb-variant-tab" key={variant._k}>
            <input
              value={variant.label}
              placeholder="Java"
              onChange={(e) => setVariant(i, { label: e.target.value })}
            />
            {i > 0 && (
              <button
                type="button"
                className="icon-btn"
                title="Move left"
                onClick={() => patch({ variants: move(block.variants, i, i - 1) })}
              >
                ←
              </button>
            )}
            <button
              type="button"
              className="icon-btn"
              aria-label="Remove variant"
              onClick={() => patch({ variants: block.variants.filter((_, j) => j !== i) })}
            >
              <IconClose size={11} />
            </button>
          </span>
        ))}
        <button
          type="button"
          className="link-btn"
          onClick={() =>
            patch({
              variants: [
                ...block.variants,
                { lang: 'cpp', label: 'C++', code: '', _k: nextKey() },
              ],
            })
          }
        >
          <IconPlus size={11} /> Variant
        </button>
      </div>

      {block.variants.map((variant, i) => (
        <div className="gb-variant-body" key={variant._k}>
          <div className="field-row">
            <div className="field" style={{ flex: 1 }}>
              <span>Language</span>
              <Dropdown
                ariaLabel="Language"
                value={variant.lang}
                onChange={(lang) => setVariant(i, { lang })}
                options={LANG_OPTIONS}
              />
            </div>
          </div>
          <textarea
            className="gb-code"
            rows={12}
            spellCheck={false}
            wrap="off"
            value={variant.code}
            onChange={(e) => setVariant(i, { code: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * What kind of grid this is.
 *
 * Three values and not a checkbox, because they are not degrees of one thing. A
 * plain table is a table; a `data` grid is input the reader is being handed; a
 * `result` grid is what the query gave back, and the stylesheet draws it with
 * the track's hue on its edge because it is the only grid on the page that is an
 * answer. The empty string is the default and reads as "just a table" — it is
 * what every table written before these existed still carries.
 */
const VARIANT_OPTIONS = [
  { value: '', label: 'Plain table' },
  { value: 'data', label: 'Sample data' },
  { value: 'result', label: 'Query result' },
  // Rows of `[label, what to say]`, drawn as a card. Its header row is hidden
  // by the stylesheet, so the two column names are never seen — they exist
  // because GuideBlocks keys header cells on them and two blanks collide.
  { value: 'quick', label: 'Interview quick look' },
];

/**
 * The table editor, and its one invariant: every row has exactly one cell per
 * column. GuideBlocks maps rows blind, so a short row silently loses a cell and
 * nobody notices until a reader sees a hole. Enforced in these helpers rather
 * than checked at save.
 */
function TableFields({ block, patch }) {
  const setCell = (r, c, value) => {
    const rows = block.rows.map((row, i) =>
      i === r ? row.map((cell, j) => (j === c ? value : cell)) : row,
    );
    patch({ rows });
  };

  const addColumn = () =>
    patch({
      columns: [...block.columns, ''],
      rows: block.rows.map((row) => [...row, '']),
    });

  const removeColumn = (c) =>
    patch({
      columns: block.columns.filter((_, j) => j !== c),
      rows: block.rows.map((row) => row.filter((_, j) => j !== c)),
    });

  return (
    <div className="field">
      <span>Table</span>

      <div className="field-row">
        <label className="field" style={{ flex: 1 }}>
          <span>Caption</span>
          <input
            value={block.caption || ''}
            /*
              Not decoration. On a sample grid this is the table's real name —
              the one the FROM clause underneath it uses — so leaving it blank
              is what turns three grids in a row into a page the reader has to
              count their way through.
            */
            placeholder="Optional — the grid's name, e.g. employees"
            onChange={(e) => patch({ caption: e.target.value })}
          />
        </label>
        <div className="field" style={{ flex: 1 }}>
          <span>Kind</span>
          <Dropdown
            ariaLabel="Table kind"
            value={block.variant || ''}
            onChange={(variant) => patch({ variant })}
            options={VARIANT_OPTIONS}
          />
        </div>
      </div>

      <div className="gb-grid">
        <div className="gb-grid-row gb-grid-head">
          {block.columns.map((col, c) => (
            <span key={c} className="gb-cell">
              <input
                value={col}
                placeholder={`Column ${c + 1}`}
                onChange={(e) => {
                  const columns = [...block.columns];
                  columns[c] = e.target.value;
                  patch({ columns });
                }}
              />
              {block.columns.length > 1 && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Remove column"
                  onClick={() => removeColumn(c)}
                >
                  <IconClose size={10} />
                </button>
              )}
            </span>
          ))}
        </div>

        {block.rows.map((row, r) => (
          <div className="gb-grid-row" key={r}>
            {row.map((cell, c) => (
              <span key={c} className="gb-cell">
                <input value={cell} onChange={(e) => setCell(r, c, e.target.value)} />
              </span>
            ))}
            <button
              type="button"
              className="icon-btn"
              aria-label="Remove row"
              onClick={() => patch({ rows: block.rows.filter((_, i) => i !== r) })}
            >
              <IconClose size={10} />
            </button>
          </div>
        ))}
      </div>

      <div className="gb-grid-acts">
        <button type="button" className="link-btn" onClick={addColumn}>
          + Column
        </button>
        <button
          type="button"
          className="link-btn"
          onClick={() => patch({ rows: [...block.rows, block.columns.map(() => '')] })}
        >
          + Row
        </button>
      </div>
    </div>
  );
}
