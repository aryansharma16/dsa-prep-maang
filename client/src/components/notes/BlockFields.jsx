import { useRef } from 'react';
import { Dropdown } from '../ui/Dropdown.jsx';
import {
  IconCheck,
  IconClose,
  IconFile,
  IconImage,
  IconPlus,
  IconUpload,
} from '../ui/Icons.jsx';
import { AutoTextarea } from './AutoTextarea.jsx';
import {
  deriveSource,
  extractVideoId,
  humanBytes,
  move,
  nextKey,
} from './blockTypes.js';

/**
 * The editing surface for one block, one case per type.
 *
 * The guiding rule, and the reason this does not look like the admin guide
 * editor's stack of labelled form rows: **a block is edited in the shape it will
 * be read in.** A heading is typed into something that looks like a heading; a
 * checklist has real checkboxes you can tick while writing; a callout is already
 * tinted its tone. Labels appear only where the shape alone would not say what a
 * field is.
 *
 * That costs a little CSS and buys the thing a notes app lives or dies on:
 * there is no translation step between writing and reading, so nobody has to
 * keep a preview open to know what they are making.
 */

const LANGS = [
  'javascript',
  'typescript',
  'java',
  'cpp',
  'python',
  'go',
  'rust',
  'sql',
  'bash',
  'json',
  'yaml',
  'text',
].map((l) => ({ value: l, label: l }));

const TONES = [
  { id: 'note', label: 'Note' },
  { id: 'tip', label: 'Tip' },
  { id: 'warn', label: 'Watch out' },
  { id: 'danger', label: 'Careful' },
  { id: 'success', label: 'Worked' },
];

const LIST_VARIANTS = [
  { id: 'bullet', label: '•' , title: 'Bullets' },
  { id: 'numbered', label: '1.', title: 'Numbered' },
  { id: 'check', label: '✓', title: 'Checklist' },
  { id: 'arrow', label: '→', title: 'Arrows' },
  { id: 'plain', label: '—', title: 'No marker' },
];

/**
 * The upload button every asset block shares.
 *
 * `onFiles` goes up to the editor, which owns the note id — an upload needs one,
 * and a note that has never been saved does not have one yet. Resolving that is
 * the editor's job, not a button's.
 */
function Picker({ accept, multiple, busy, onFiles, children }) {
  const inputRef = useRef(null);
  return (
    <>
      <button
        type="button"
        className="nb-upload"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <IconUpload size={14} />
        {busy ? 'Uploading…' : children}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          const files = [...(e.target.files || [])];
          // Cleared so picking the same file twice in a row still fires.
          e.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </>
  );
}

export function BlockFields({ block, onChange, upload, uploading }) {
  /**
   * Applies changes to this block.
   *
   * Takes either an object or a function of the block's *current* value. The
   * function form is what an async caller needs: `{ ...block, ...changes }`
   * spreads the block from the render that created the handler, so an upload
   * resolving seconds later would write back a copy that predates everything
   * typed since. Anything reading the block's existing value — appending to a
   * gallery, filtering an array — must use it.
   */
  const patch = (changes) =>
    onChange((prev) => ({
      ...prev,
      ...(typeof changes === 'function' ? changes(prev) : changes),
    }));

  switch (block.type) {
    case 'heading':
      return (
        <div className="nb-heading">
          <div className="nb-levels" role="group" aria-label="Heading size">
            {[2, 3, 4].map((level) => (
              <button
                key={level}
                type="button"
                className={`nb-level ${(block.level || 2) === level ? 'on' : ''}`}
                onClick={() => patch({ level })}
                title={`Heading ${level}`}
              >
                H{level - 1}
              </button>
            ))}
          </div>
          <AutoTextarea
            className={`nb-text h${block.level || 2}`}
            value={block.text}
            placeholder="Section title"
            onChange={(text) => patch({ text })}
          />
        </div>
      );

    case 'paragraph':
      return (
        <AutoTextarea
          className="nb-text body"
          value={block.text}
          placeholder="Write it the way you would explain it to yourself in six months…"
          onChange={(text) => patch({ text })}
        />
      );

    case 'list':
      return <ListFields block={block} patch={patch} />;

    case 'callout':
      return (
        <div className={`nb-callout tone-${block.tone || 'note'}`}>
          <div className="nb-tones">
            {TONES.map((tone) => (
              <button
                key={tone.id}
                type="button"
                className={`nb-tone t-${tone.id} ${block.tone === tone.id ? 'on' : ''}`}
                onClick={() => patch({ tone: tone.id })}
              >
                {tone.label}
              </button>
            ))}
          </div>
          <input
            className="nb-callout-title"
            value={block.title || ''}
            placeholder={TONES.find((t) => t.id === block.tone)?.label || 'Note'}
            onChange={(e) => patch({ title: e.target.value })}
          />
          <AutoTextarea
            className="nb-text body"
            value={block.text}
            placeholder="The thing that will bite you…"
            onChange={(text) => patch({ text })}
          />
        </div>
      );

    case 'quote':
      return (
        <div className="nb-quote">
          <AutoTextarea
            className="nb-text quote"
            value={block.text}
            placeholder="Quote"
            onChange={(text) => patch({ text })}
          />
          <input
            className="nb-cite"
            value={block.cite || ''}
            placeholder="— who said it"
            onChange={(e) => patch({ cite: e.target.value })}
          />
        </div>
      );

    case 'code':
      return <CodeFields block={block} patch={patch} />;

    case 'links':
      return <LinkFields block={block} patch={patch} />;

    case 'image':
      return (
        <div className="nb-media">
          {block.asset?.url ? (
            <>
              <div className={`nb-media-preview align-${block.align || 'center'}`}>
                <img src={block.asset.url} alt="" />
                <button
                  type="button"
                  className="nb-media-clear"
                  onClick={() => patch({ asset: null })}
                  aria-label="Remove image"
                >
                  <IconClose size={12} />
                </button>
              </div>
              <div className="nb-media-opts">
                <Segmented
                  label="Width"
                  value={block.width || 'full'}
                  options={[
                    ['inline', 'Small'],
                    ['wide', 'Wide'],
                    ['full', 'Full'],
                  ]}
                  onChange={(width) => patch({ width })}
                />
                <Segmented
                  label="Align"
                  value={block.align || 'center'}
                  options={[
                    ['left', 'Left'],
                    ['center', 'Centre'],
                    ['right', 'Right'],
                  ]}
                  onChange={(align) => patch({ align })}
                />
              </div>
            </>
          ) : (
            <Dropzone
              icon={<IconImage size={18} />}
              title="Drop a screenshot, paste it, or"
              accept="image/*"
              busy={uploading}
              onFiles={(files) => upload(files, (assets) => patch({ asset: assets[0] || null }))}
            >
              choose an image
            </Dropzone>
          )}
          <input
            className="nb-caption"
            value={block.caption || ''}
            placeholder="Caption (also the alt text)"
            onChange={(e) => patch({ caption: e.target.value })}
          />
        </div>
      );

    case 'gallery':
      return (
        <div className="nb-media">
          {block.assets?.length > 0 && (
            <div className="nb-gallery-strip">
              {block.assets.map((asset, i) => (
                <span key={asset.fileId || i}>
                  <img src={asset.url} alt="" />
                  <button
                    type="button"
                    className="nb-media-clear"
                    onClick={() =>
                      patch((prev) => ({
                        assets: (prev.assets || []).filter((_, j) => j !== i),
                      }))
                    }
                    aria-label="Remove image"
                  >
                    <IconClose size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <Dropzone
            icon={<IconImage size={18} />}
            title={block.assets?.length ? 'Add more —' : 'Drop images here, or'}
            accept="image/*"
            multiple
            busy={uploading}
            onFiles={(files) =>
              /*
                Appends to the gallery's value at the moment the upload lands,
                not to the one captured when it started — otherwise dropping a
                second batch before the first finishes keeps only one of them.
              */
              upload(files, (assets) =>
                patch((prev) => ({ assets: [...(prev.assets || []), ...assets] })),
              )
            }
          >
            choose images
          </Dropzone>
          <input
            className="nb-caption"
            value={block.caption || ''}
            placeholder="Caption"
            onChange={(e) => patch({ caption: e.target.value })}
          />
        </div>
      );

    case 'file':
      return (
        <div className="nb-media">
          {block.asset ? (
            <div className="nb-file-row">
              <span className="nb-file-icon">
                <IconFile size={15} />
              </span>
              <span className="nb-file-meta">
                <strong>{block.asset.name}</strong>
                <span>{humanBytes(block.asset.bytes)}</span>
              </span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => patch({ asset: null })}
                aria-label="Remove file"
              >
                <IconClose size={12} />
              </button>
            </div>
          ) : (
            <Dropzone
              icon={<IconFile size={18} />}
              title="Drop a PDF here, or"
              accept="application/pdf"
              busy={uploading}
              onFiles={(files) => upload(files, (assets) => patch({ asset: assets[0] || null }))}
            >
              choose a file
            </Dropzone>
          )}
          <input
            className="nb-caption"
            value={block.title || ''}
            placeholder="What is it? (shown on the card)"
            onChange={(e) => patch({ title: e.target.value })}
          />
        </div>
      );

    case 'video':
      return (
        <div className="nb-media">
          {/^[\w-]{11}$/.test(block.videoId || '') && (
            <div className="nb-video-preview">
              <img
                src={`https://i.ytimg.com/vi/${block.videoId}/mqdefault.jpg`}
                alt=""
                loading="lazy"
              />
            </div>
          )}
          <input
            className="nb-caption mono"
            value={block.videoId || ''}
            placeholder="Paste a YouTube URL"
            onChange={(e) => patch({ videoId: e.target.value })}
            // Extracted on blur rather than per keystroke, so pasting a URL and
            // typing an id both land right without fighting the caret.
            onBlur={(e) => patch({ videoId: extractVideoId(e.target.value) })}
          />
          <input
            className="nb-caption"
            value={block.caption || ''}
            placeholder="Caption"
            onChange={(e) => patch({ caption: e.target.value })}
          />
        </div>
      );

    case 'table':
      return <TableFields block={block} patch={patch} />;

    case 'divider':
      return <div className="nb-divider-preview" aria-hidden="true" />;

    case 'dropdown':
      // The title only. Its children are rendered by the editor itself, because
      // they are blocks and need the same drag, insert and delete affordances as
      // everything else on the canvas.
      return (
        <input
          className="nb-drop-title"
          value={block.title}
          placeholder="What is hidden in here?"
          onChange={(e) => patch({ title: e.target.value })}
        />
      );

    default:
      return <p className="hint">No editor for “{block.type}” blocks in this build.</p>;
  }
}

/* -------------------------------------------------------------------------- */
/* shared bits                                                                 */
/* -------------------------------------------------------------------------- */

function Segmented({ label, value, options, onChange }) {
  return (
    <span className="nb-seg" role="group" aria-label={label}>
      {options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          className={value === id ? 'on' : ''}
          onClick={() => onChange(id)}
        >
          {text}
        </button>
      ))}
    </span>
  );
}

/**
 * The drop target for an empty media block.
 *
 * Drag events are counted rather than toggled: dragging over a child element
 * fires `dragleave` on the parent, so a single boolean flickers the highlight
 * off every time the pointer crosses the icon inside it.
 */
function Dropzone({ icon, title, accept, multiple, busy, onFiles, children }) {
  const depth = useRef(0);
  const zoneRef = useRef(null);

  const setActive = (on) => zoneRef.current?.classList.toggle('over', on);

  return (
    <div
      ref={zoneRef}
      className="nb-drop"
      onDragEnter={(e) => {
        e.preventDefault();
        depth.current += 1;
        setActive(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        depth.current -= 1;
        if (depth.current <= 0) setActive(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        depth.current = 0;
        setActive(false);
        const files = [...(e.dataTransfer?.files || [])];
        if (files.length) onFiles(multiple ? files : files.slice(0, 1));
      }}
    >
      <span className="nb-drop-icon">{icon}</span>
      <span className="nb-drop-text">
        {title}{' '}
        <Picker accept={accept} multiple={multiple} busy={busy} onFiles={onFiles}>
          {children}
        </Picker>
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* lists                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The points editor.
 *
 * Every key that would do something in a real list does it here: Enter starts
 * the next point, Backspace on an empty one removes it and puts the caret at the
 * end of the previous, Tab and Shift+Tab indent. Writing eight bullets otherwise
 * costs eight trips to a button, which is how a notes app stops being used.
 */
function ListFields({ block, patch }) {
  const items = block.items || [];
  const refs = useRef([]);

  const setItem = (i, changes) =>
    patch({ items: items.map((item, j) => (j === i ? { ...item, ...changes } : item)) });

  const focusAt = (i, caret = 'end') => {
    // After React commits the new array — the node does not exist before that.
    requestAnimationFrame(() => {
      const node = refs.current[i];
      if (!node) return;
      node.focus();
      if (caret === 'end') node.setSelectionRange(node.value.length, node.value.length);
    });
  };

  const onKeyDown = (event, i) => {
    const item = items[i];

    if (event.key === 'Enter') {
      event.preventDefault();
      const next = [...items];
      // Inherits the indent, which is what makes a sub-list writable without
      // re-tabbing on every line.
      next.splice(i + 1, 0, { text: '', checked: false, depth: item.depth || 0, _k: nextKey() });
      patch({ items: next });
      focusAt(i + 1);
      return;
    }

    if (event.key === 'Backspace' && !item.text) {
      if (items.length === 1) return;
      event.preventDefault();
      patch({ items: items.filter((_, j) => j !== i) });
      focusAt(Math.max(0, i - 1));
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      const depth = (item.depth || 0) + (event.shiftKey ? -1 : 1);
      setItem(i, { depth: Math.max(0, Math.min(2, depth)) });
    }
  };

  return (
    <div className="nb-list">
      <div className="nb-list-variants" role="group" aria-label="List style">
        {LIST_VARIANTS.map((variant) => (
          <button
            key={variant.id}
            type="button"
            title={variant.title}
            className={`nb-variant ${block.variant === variant.id ? 'on' : ''}`}
            onClick={() => patch({ variant: variant.id })}
          >
            {variant.label}
          </button>
        ))}
      </div>

      {items.map((item, i) => (
        <div className={`nb-point d${item.depth || 0}`} key={item._k || i}>
          {block.variant === 'check' ? (
            <button
              type="button"
              className={`nb-tick ${item.checked ? 'on' : ''}`}
              onClick={() => setItem(i, { checked: !item.checked })}
              aria-label={item.checked ? 'Uncheck' : 'Check'}
            >
              {item.checked && <IconCheck size={10} />}
            </button>
          ) : (
            <span className="nb-bullet" aria-hidden="true">
              {block.variant === 'numbered'
                ? `${items.filter((x, j) => j <= i && (x.depth || 0) === (item.depth || 0)).length}.`
                : block.variant === 'arrow'
                  ? '→'
                  : block.variant === 'plain'
                    ? ''
                    : '•'}
            </span>
          )}
          <input
            ref={(node) => {
              refs.current[i] = node;
            }}
            className={item.checked ? 'done' : ''}
            value={item.text}
            placeholder={i === 0 ? 'A point…' : ''}
            onChange={(e) => setItem(i, { text: e.target.value })}
            onKeyDown={(e) => onKeyDown(e, i)}
          />
          <button
            type="button"
            className="icon-btn"
            aria-label="Remove point"
            onClick={() => patch({ items: items.filter((_, j) => j !== i) })}
          >
            <IconClose size={11} />
          </button>
        </div>
      ))}

      <button
        type="button"
        className="nb-add-row"
        onClick={() =>
          patch({ items: [...items, { text: '', checked: false, depth: 0, _k: nextKey() }] })
        }
      >
        <IconPlus size={11} /> Point
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* code                                                                        */
/* -------------------------------------------------------------------------- */

function CodeFields({ block, patch }) {
  const variants = block.variants || [];
  const setVariant = (i, changes) =>
    patch({ variants: variants.map((v, j) => (j === i ? { ...v, ...changes } : v)) });

  return (
    <div className="nb-code">
      {variants.map((variant, i) => (
        <div className="nb-code-tab" key={variant._k || i}>
          <div className="nb-code-bar">
            <input
              className="nb-code-file"
              value={variant.filename || ''}
              placeholder="filename.js (optional)"
              onChange={(e) => setVariant(i, { filename: e.target.value })}
            />
            <Dropdown
              ariaLabel="Language"
              variant="inline"
              value={variant.lang || 'text'}
              onChange={(lang) => setVariant(i, { lang })}
              options={LANGS}
              searchable
            />
            {i > 0 && (
              <button
                type="button"
                className="icon-btn"
                title="Move left"
                onClick={() => patch({ variants: move(variants, i, i - 1) })}
              >
                ←
              </button>
            )}
            {variants.length > 1 && (
              <button
                type="button"
                className="icon-btn"
                aria-label="Remove tab"
                onClick={() => patch({ variants: variants.filter((_, j) => j !== i) })}
              >
                <IconClose size={11} />
              </button>
            )}
          </div>
          <AutoTextarea
            className="nb-code-area"
            minRows={3}
            spellCheck={false}
            wrap="off"
            value={variant.code}
            placeholder="Paste the code, the config, or the stack trace…"
            onChange={(code) => setVariant(i, { code })}
            onKeyDown={(e) => {
              // Tab indents instead of leaving the field. In a code box that is
              // what the key means, and the block is reachable by arrow keys.
              if (e.key !== 'Tab' || e.shiftKey) return;
              e.preventDefault();
              const el = e.target;
              const { selectionStart: start, selectionEnd: end } = el;
              const next = `${el.value.slice(0, start)}  ${el.value.slice(end)}`;
              setVariant(i, { code: next });
              requestAnimationFrame(() => el.setSelectionRange(start + 2, start + 2));
            }}
          />
        </div>
      ))}

      <button
        type="button"
        className="nb-add-row"
        onClick={() =>
          patch({
            variants: [
              ...variants,
              { lang: 'text', label: '', filename: '', code: '', _k: nextKey() },
            ],
          })
        }
      >
        <IconPlus size={11} /> Another language
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* links                                                                       */
/* -------------------------------------------------------------------------- */

function LinkFields({ block, patch }) {
  const links = block.links || [];
  const setLink = (i, changes) =>
    patch({ links: links.map((l, j) => (j === i ? { ...l, ...changes } : l)) });

  return (
    <div className="nb-links">
      {links.map((link, i) => (
        <div className="nb-link-row" key={link._k || i}>
          <input
            value={link.label}
            placeholder="What it is"
            onChange={(e) => setLink(i, { label: e.target.value })}
          />
          <input
            className="mono"
            value={link.url}
            placeholder="https://…"
            onChange={(e) => setLink(i, { url: e.target.value })}
            // Only fills an empty source, so a hand-written one is never lost.
            onBlur={(e) => !link.source && setLink(i, { source: deriveSource(e.target.value) })}
          />
          <button
            type="button"
            className="icon-btn"
            aria-label="Remove link"
            onClick={() => patch({ links: links.filter((_, j) => j !== i) })}
          >
            <IconClose size={11} />
          </button>
        </div>
      ))}

      <div className="nb-link-foot">
        <button
          type="button"
          className="nb-add-row"
          onClick={() =>
            patch({ links: [...links, { label: '', url: '', source: '', _k: nextKey() }] })
          }
        >
          <IconPlus size={11} /> Link
        </button>
        <Segmented
          label="Style"
          value={block.variant || 'cards'}
          options={[
            ['cards', 'Cards'],
            ['list', 'List'],
          ]}
          onChange={(variant) => patch({ variant })}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* table                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The table editor, and its one invariant: every row has exactly one cell per
 * column. The renderer maps rows blind, so a short row silently loses a cell and
 * nobody notices until a reader sees a hole — enforced in these helpers rather
 * than checked at save time.
 */
function TableFields({ block, patch }) {
  const setCell = (r, c, value) =>
    patch({
      rows: block.rows.map((row, i) =>
        i === r ? row.map((cell, j) => (j === c ? value : cell)) : row,
      ),
    });

  return (
    <div className="nb-table">
      <div className="nb-table-scroll">
        <table>
          <thead>
            <tr>
              {block.columns.map((col, c) => (
                <th key={c}>
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
                      className="nb-table-x"
                      aria-label={`Remove column ${c + 1}`}
                      onClick={() =>
                        patch({
                          columns: block.columns.filter((_, j) => j !== c),
                          rows: block.rows.map((row) => row.filter((_, j) => j !== c)),
                        })
                      }
                    >
                      <IconClose size={9} />
                    </button>
                  )}
                </th>
              ))}
              <th className="nb-table-gutter" />
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c}>
                    <input value={cell} onChange={(e) => setCell(r, c, e.target.value)} />
                  </td>
                ))}
                <td className="nb-table-gutter">
                  <button
                    type="button"
                    className="nb-table-x"
                    aria-label={`Remove row ${r + 1}`}
                    onClick={() => patch({ rows: block.rows.filter((_, i) => i !== r) })}
                  >
                    <IconClose size={9} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="nb-table-acts">
        <button
          type="button"
          className="nb-add-row"
          onClick={() =>
            patch({
              columns: [...block.columns, ''],
              rows: block.rows.map((row) => [...row, '']),
            })
          }
        >
          <IconPlus size={11} /> Column
        </button>
        <button
          type="button"
          className="nb-add-row"
          onClick={() => patch({ rows: [...block.rows, block.columns.map(() => '')] })}
        >
          <IconPlus size={11} /> Row
        </button>
      </div>
    </div>
  );
}
