import { useEffect, useRef, useState } from 'react';
import {
  IconChevronRight,
  IconCopy,
  IconGrip,
  IconPlus,
  IconTrash,
} from '../ui/Icons.jsx';
import { BlockFields } from './BlockFields.jsx';
import { BlockPalette } from './BlockPalette.jsx';
import { LEAF_TYPES, TYPE, blankBlock, hueOf, move, toPayload, withKeys } from './blockTypes.js';

/**
 * An ordered list of blocks, and every operation on one.
 *
 * Recursion is handled by using this component for a dropdown's children as
 * well, each instance owning its own array and reporting a whole new array
 * upward. That is what keeps the editor free of path plumbing: no
 * `[2, 'children', 0]` threaded through six handlers, no index arithmetic that
 * silently targets the wrong list after a reorder. A nested list can only ever
 * reorder itself.
 *
 * `depth` is the only thing the two levels disagree on — the inner one offers
 * no dropdown, because the server refuses one inside another.
 */
export function BlockList({ blocks, onChange, upload, uploading, depth = 0 }) {
  const [palette, setPalette] = useState(null); // insertion index, or null
  const [dragging, setDragging] = useState(null);
  const [dropAt, setDropAt] = useState(null);
  const [focusKey, setFocusKey] = useState(null);

  const setBlock = (i, next) => onChange(blocks.map((b, j) => (j === i ? next : b)));

  const insert = (type, at) => {
    const block = blankBlock(type);
    const next = [...blocks];
    next.splice(at, 0, block);
    onChange(next);
    setPalette(null);
    // The point of inserting is to type into it. Without this every insert
    // costs a click back into the block you just asked for.
    setFocusKey(block._k);
  };

  const remove = (i) => onChange(blocks.filter((_, j) => j !== i));

  const duplicate = (i) => {
    const next = [...blocks];
    // Through the payload and back, so the copy carries no server `id` — two
    // blocks sharing one id is what makes the anchors collide.
    const { id, ...clean } = toPayload(blocks[i]);
    next.splice(i + 1, 0, withKeys(clean));
    onChange(next);
  };

  /*
    Drag reorder with an explicit gap indicator, rather than the swap-on-hover
    the admin guide editor uses. Swapping mutates the list under the pointer
    while you are still deciding, so a drag across four blocks shuffles all four
    and the drop lands somewhere you did not choose. Here nothing moves until
    the drop, and the line shows exactly where it will land.
  */
  const onDragOver = (event, i) => {
    event.preventDefault();
    if (dragging === null) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;
    setDropAt(after ? i + 1 : i);
  };

  const onDrop = () => {
    if (dragging !== null && dropAt !== null) {
      // Removing the dragged block shifts everything after it down by one.
      const target = dropAt > dragging ? dropAt - 1 : dropAt;
      if (target !== dragging) onChange(move(blocks, dragging, target));
    }
    setDragging(null);
    setDropAt(null);
  };

  const allow = depth > 0 ? LEAF_TYPES.map((t) => t.type) : undefined;

  return (
    <div className={`nb-list-wrap ${dragging !== null ? 'dragging' : ''}`} onDrop={onDrop}>
      <Inserter
        open={palette === 0}
        onOpen={() => setPalette(palette === 0 ? null : 0)}
        onPick={(type) => insert(type, 0)}
        allow={allow}
        first={blocks.length === 0}
        active={dropAt === 0}
      />

      {blocks.map((block, i) => (
        <div key={block._k}>
          <BlockCard
            block={block}
            index={i}
            total={blocks.length}
            depth={depth}
            focused={focusKey === block._k}
            onFocused={() => setFocusKey(null)}
            dragging={dragging === i}
            onDragStart={() => setDragging(i)}
            onDragEnd={() => {
              setDragging(null);
              setDropAt(null);
            }}
            onDragOver={(e) => onDragOver(e, i)}
            onChange={(next) => setBlock(i, next)}
            onRemove={() => remove(i)}
            onDuplicate={() => duplicate(i)}
            onMove={(delta) => onChange(move(blocks, i, i + delta))}
            upload={upload}
            uploading={uploading}
          />

          <Inserter
            open={palette === i + 1}
            onOpen={() => setPalette(palette === i + 1 ? null : i + 1)}
            onPick={(type) => insert(type, i + 1)}
            allow={allow}
            active={dropAt === i + 1}
            last={i === blocks.length - 1}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * The gap between two blocks.
 *
 * Always in the DOM and normally almost invisible — a hairline that thickens on
 * hover. The alternative, a button that appears only on hover, is a target you
 * have to already know exists; this one is discoverable by moving the mouse down
 * the page, and it doubles as the drop indicator during a drag, so the two
 * things that can happen in a gap look like the same thing.
 */
function Inserter({ open, onOpen, onPick, allow, first, last, active }) {
  const shown = first || last;
  return (
    <div
      className={`nb-gap ${open ? 'open' : ''} ${active ? 'drop' : ''} ${
        shown ? 'shown' : ''
      } ${first ? 'first' : ''}`}
    >
      <button type="button" className="nb-gap-btn" onClick={onOpen} aria-expanded={open}>
        <IconPlus size={12} />
        {shown && <span>{first ? 'Add your first block' : 'Add a block'}</span>}
      </button>

      {open && (
        <div className="nb-palette-wrap">
          <BlockPalette onPick={onPick} onClose={onOpen} allow={allow} />
        </div>
      )}
    </div>
  );
}

/**
 * One block on the canvas: the coloured rail, the hover toolbar, the fields.
 *
 * The toolbar sits outside the card in the left margin rather than in a header
 * strip above it. A header per block turns a twenty-block note into forty rows
 * of chrome; the margin is empty space that was already there.
 */
function BlockCard({
  block,
  index,
  total,
  depth,
  focused,
  onFocused,
  dragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onChange,
  onRemove,
  onDuplicate,
  onMove,
  upload,
  uploading,
}) {
  const ref = useRef(null);
  const kind = TYPE[block.type];
  const warn = kind?.validate?.(block) || '';

  useEffect(() => {
    if (!focused) return;
    const node = ref.current?.querySelector('textarea, input:not([type=file])');
    node?.focus();
    onFocused();
  }, [focused, onFocused]);

  return (
    <div
      ref={ref}
      className={`nb-card ${dragging ? 'is-dragging' : ''} ${warn ? 'warn' : ''}`}
      data-hue={hueOf(block.type)}
      data-type={block.type}
      onDragOver={onDragOver}
    >
      <div className="nb-rail">
        <span
          className="nb-grip"
          title="Drag to reorder"
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <IconGrip size={12} />
        </span>
        <span className="nb-badge">{kind?.label || block.type}</span>
      </div>

      <div className="nb-tools">
        <button
          type="button"
          className="icon-btn"
          title="Move up"
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          ↑
        </button>
        <button
          type="button"
          className="icon-btn"
          title="Move down"
          disabled={index === total - 1}
          onClick={() => onMove(1)}
        >
          ↓
        </button>
        <button type="button" className="icon-btn" title="Duplicate" onClick={onDuplicate}>
          <IconCopy size={12} />
        </button>
        <button type="button" className="icon-btn danger" title="Delete" onClick={onRemove}>
          <IconTrash size={12} />
        </button>
      </div>

      <div className="nb-fields">
        <BlockFields
          block={block}
          onChange={onChange}
          upload={upload}
          uploading={uploading}
        />

        {/* A dropdown's children are blocks, so they get the same list — the
            same drag, the same gaps, the same toolbar. One level only; the
            inner list is handed a type set with no dropdown in it. */}
        {block.type === 'dropdown' && depth === 0 && (
          <div className="nb-children">
            <span className="nb-children-label">
              <IconChevronRight size={10} />
              Hidden until opened
            </span>
            <BlockList
              blocks={block.children || []}
              onChange={(children) => onChange({ ...block, children })}
              upload={upload}
              uploading={uploading}
              depth={1}
            />
          </div>
        )}

        {warn && <p className="nb-warn">{warn}</p>}
      </div>
    </div>
  );
}
