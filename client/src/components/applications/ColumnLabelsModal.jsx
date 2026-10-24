import { useRef, useState } from 'react';

import { Dropdown } from '../ui/Dropdown.jsx';
import { IconChevronRight, IconGrip } from '../ui/Icons.jsx';
import { Modal } from '../ui/Modal.jsx';
import { CURRENCY_OPTIONS } from './vocab.js';

const move = (list, from, to) => {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

/**
 * What you call each lane.
 *
 * The one thing this dialog cannot do is add or remove a lane, and that is the
 * whole design rather than a missing feature. The six are the vocabulary the
 * report is computed in — conversion by source, where applications die, how
 * long anybody takes to reply — and a seventh lane somebody invented is a stage
 * no report can classify. So the key is fixed and the word is yours: call
 * "In Process" *Grinding* and every number still lands in the same bucket.
 *
 * Hiding is the escape hatch for a lane you do not use, and most people do not
 * use Wishlist. It takes the lane off the board without taking the stage out of
 * the vocabulary, so an application already sitting in a hidden lane is still
 * valid data and still counts — it is reachable from search and from the
 * drawer's stage dropdown, which offers all nine regardless.
 *
 * Order is yours too. It is presentation only — `order` on each column — so
 * putting Closed first changes where the lane is drawn and nothing about what
 * it counts.
 */
export function ColumnLabelsModal({ board, onSave, onClose }) {
  const firstRef = useRef(null);

  /** Lane keys in the order they will be drawn. */
  const [order, setOrder] = useState(() => board.columns.map((column) => column.key));
  /** Index of the row in the hand, while dragging. */
  const [dragging, setDragging] = useState(null);
  const byKey = Object.fromEntries(board.columns.map((column) => [column.key, column]));

  const [labels, setLabels] = useState(
    Object.fromEntries(board.columns.map((column) => [column.key, column.label])),
  );
  const [hidden, setHidden] = useState(
    Object.fromEntries(board.columns.map((column) => [column.key, column.hidden])),
  );
  const [currency, setCurrency] = useState(board.defaultCurrency || 'INR');
  const [staleAfterDays, setStale] = useState(String(board.staleAfterDays ?? 21));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      await onSave({
        columns: order.map((key, index) => ({
          key,
          label: (labels[key] || '').trim() || byKey[key].label,
          hidden: Boolean(hidden[key]),
          order: index,
        })),
        defaultCurrency: currency,
        staleAfterDays: Number(staleAfterDays) || 21,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'That did not save');
      setBusy(false);
    }
  };

  return (
    <Modal title="The board" size="lg" onClose={onClose} initialFocus={firstRef}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <p className="ap-muted">
            Rename a lane to whatever you call it, and drag the grip to reorder. The stages
            underneath do not change, so nothing in the report moves.
          </p>

          <div className="ap-lane-rows">
            {order.map((key, index) => {
              const column = byKey[key];
              return (
              <div
                key={column.key}
                className={`ap-lane-row ${dragging === index ? 'dragging' : ''}`}
                data-hue={column.hue}
                onDragOver={(event) => {
                  if (dragging === null) return;
                  event.preventDefault();
                  if (dragging === index) return;
                  // Live reorder: six rows, so moving them under the pointer reads clearly.
                  setOrder((prev) => move(prev, dragging, index));
                  setDragging(index);
                }}
                onDrop={(event) => event.preventDefault()}
              >
                {/* Only the grip drags, so selecting text in the name still works. */}
                <span
                  className="ap-lane-grip"
                  title="Drag to reorder"
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', column.key);
                    const row = event.currentTarget.parentElement;
                    event.dataTransfer.setDragImage(row, 12, row.offsetHeight / 2);
                    setDragging(index);
                  }}
                  onDragEnd={() => setDragging(null)}
                >
                  <IconGrip size={14} />
                </span>
                <i className="ap-dot" aria-hidden="true" />
                <input
                  ref={index === 0 ? firstRef : undefined}
                  value={labels[column.key]}
                  maxLength={40}
                  aria-label={`What to call the ${column.label} lane`}
                  onChange={(event) =>
                    setLabels((current) => ({ ...current, [column.key]: event.target.value }))
                  }
                />
                <label className="ap-lane-hide">
                  <input
                    type="checkbox"
                    checked={!hidden[column.key]}
                    onChange={(event) =>
                      setHidden((current) => ({
                        ...current,
                        [column.key]: !event.target.checked,
                      }))
                    }
                  />
                  <span>Show</span>
                </label>
                <span className="col-move">
                  <button
                    type="button"
                    className="icon-btn up"
                    disabled={index === 0}
                    title="Move up"
                    aria-label={`Move ${labels[key] || column.label} up`}
                    onClick={() => setOrder((prev) => move(prev, index, index - 1))}
                  >
                    <IconChevronRight size={12} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn down"
                    disabled={index === order.length - 1}
                    title="Move down"
                    aria-label={`Move ${labels[key] || column.label} down`}
                    onClick={() => setOrder((prev) => move(prev, index, index + 1))}
                  >
                    <IconChevronRight size={12} />
                  </button>
                </span>
              </div>
              );
            })}
          </div>

          <div className="field-row">
            <label className="field">
              <span>Currency for a new offer</span>
              <Dropdown
                ariaLabel="Default currency"
                value={currency}
                options={CURRENCY_OPTIONS}
                onChange={setCurrency}
              />
            </label>
            <label className="field">
              <span>Call it quiet after</span>
              <input
                type="number"
                min={3}
                max={180}
                value={staleAfterDays}
                onChange={(event) => setStale(event.target.value)}
              />
              <span className="field-hint">
                Days of silence before a live card is marked. It only ever adds a badge — nothing
                here moves a card you did not drag.
              </span>
            </label>
          </div>

          {error && <div className="alert">{error}</div>}
        </div>

        <div className="modal-foot">
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
