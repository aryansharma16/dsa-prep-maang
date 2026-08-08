import { useState } from 'react';
import { IconChevronRight, IconGrip, IconPin } from '../ui/Icons.jsx';
import { Modal } from '../ui/Modal.jsx';
import { COLUMN_BY_ID, SIZES, widthOf } from './columns.jsx';
import {
  MAX_PINNED,
  RIGHT_PINNED,
  defaultLayout,
  pinnedCount,
} from '../../hooks/useTableLayout.js';

const move = (list, from, to) => {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

/**
 * Edits a draft copy and commits on save. Applying every click straight to the
 * table would re-render 400-odd rows per keystroke of fiddling, and there would
 * be no way to back out of an experiment.
 */
export function ColumnsModal({ layout, onSave, onClose }) {
  const [draft, setDraft] = useState(layout);
  const [dragging, setDragging] = useState(null);

  const shown = draft.filter((entry) => entry.show).length;
  const pins = pinnedCount(draft);
  const pinsFull = pins >= MAX_PINNED;

  const patch = (id, changes) =>
    setDraft((prev) => prev.map((e) => (e.id === id ? { ...e, ...changes } : e)));

  const togglePin = (entry) => {
    if (!entry.pin && pinsFull) return;
    // Pinning something hidden would freeze a column you cannot see.
    patch(entry.id, { pin: !entry.pin, show: entry.pin ? entry.show : true });
  };

  // Which of the three left slots a column occupies, for the badge.
  const pinRank = (id) => draft.filter((e) => e.pin).findIndex((e) => e.id === id) + 1;

  const onDragOver = (index) => {
    if (dragging === null || dragging === index) return;
    setDraft((prev) => move(prev, dragging, index));
    setDragging(index);
  };

  return (
    <Modal title="Columns" size="lg" onClose={onClose}>
      <div className="modal-body">
        <p className="hint" style={{ marginTop: 0 }}>
          Pick what the problems table shows, drag to reorder, pin up to {MAX_PINNED} columns to the
          left edge, and set how wide each one opens. Saved in this browser.
        </p>
        <p className="hint dim">
          XS–XL is relative to each column, so <b>M</b> is the width it was designed at. Pinned
          columns and Track stay put while everything between them scrolls.
        </p>

        <div className="col-counts">
          <span className="col-count">
            {shown} of {draft.length} shown
          </span>
          <span className={`col-count ${pinsFull ? 'full' : ''}`}>
            {pins} of {MAX_PINNED} pinned
            {pinsFull && ' — unpin one to pin another'}
          </span>
        </div>

        <div className="col-table">
          <div className="col-table-head">
            <span />
            <span>Show · Column</span>
            <span className="col-width-head">Width</span>
            <span className="col-px-head">px</span>
            <span className="col-move-head">Move · Pin</span>
          </div>

          {draft.map((entry, index) => {
            const column = COLUMN_BY_ID[entry.id];
            return (
              <div
                key={entry.id}
                className={`col-row ${dragging === index ? 'dragging' : ''} ${
                  entry.show ? '' : 'off'
                }`}
                draggable
                onDragStart={() => setDragging(index)}
                onDragEnd={() => setDragging(null)}
                onDragOver={(e) => {
                  e.preventDefault();
                  onDragOver(index);
                }}
              >
                <span className="col-grip" title="Drag to reorder">
                  <IconGrip size={14} />
                </span>

                <label className="col-name">
                  <input
                    type="checkbox"
                    checked={entry.show}
                    disabled={column.required}
                    onChange={(e) => patch(entry.id, { show: e.target.checked })}
                  />
                  <span>{column.label}</span>
                  {entry.pin && <span className="col-badge">PINNED {pinRank(entry.id)}</span>}
                  {entry.id === RIGHT_PINNED && <span className="col-badge">PINNED RIGHT</span>}
                  {column.required && !entry.pin && <span className="col-badge muted">ALWAYS</span>}
                  {!entry.show && <span className="col-badge muted">HIDDEN</span>}
                </label>

                <span className="size-group">
                  {SIZES.map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={entry.size === size ? 'on' : ''}
                      disabled={column.fixed}
                      title={
                        column.fixed
                          ? `${column.label} is a fixed-width column`
                          : `${widthOf(column, size)}px`
                      }
                      onClick={() => patch(entry.id, { size })}
                    >
                      {size}
                    </button>
                  ))}
                </span>

                <span className="col-px">
                  {column.fixed ? column.width : widthOf(column, entry.size)}px
                </span>

                <span className="col-move">
                  <button
                    type="button"
                    className="icon-btn up"
                    disabled={index === 0}
                    title="Move up"
                    onClick={() => setDraft((prev) => move(prev, index, index - 1))}
                  >
                    <IconChevronRight size={12} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn down"
                    disabled={index === draft.length - 1}
                    title="Move down"
                    onClick={() => setDraft((prev) => move(prev, index, index + 1))}
                  >
                    <IconChevronRight size={12} />
                  </button>
                  <button
                    type="button"
                    className={`icon-btn pin ${entry.pin ? 'on' : ''}`}
                    disabled={entry.id === RIGHT_PINNED || (!entry.pin && pinsFull)}
                    title={
                      entry.id === RIGHT_PINNED
                        ? 'Track is always frozen to the right edge'
                        : entry.pin
                          ? 'Unpin from the left edge'
                          : pinsFull
                            ? `Already pinning ${MAX_PINNED} — unpin one first`
                            : 'Pin to the left edge'
                    }
                    onClick={() => togglePin(entry)}
                  >
                    <IconPin size={12} filled={entry.pin || entry.id === RIGHT_PINNED} />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="modal-foot">
        <button type="button" className="link-btn danger" onClick={() => setDraft(defaultLayout())}>
          Reset to default
        </button>
        <span className="spacer" />
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            onSave(draft);
            onClose();
          }}
        >
          Save layout
        </button>
      </div>
    </Modal>
  );
}
