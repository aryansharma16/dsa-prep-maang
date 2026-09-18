import { useState } from 'react';

import { Dropdown } from '../ui/Dropdown.jsx';
import { IconPlus, IconTrash } from '../ui/Icons.jsx';
import { stamp } from './time.js';
import { TOUCHPOINT_OPTIONS, touchpointLabel } from './vocab.js';

/**
 * The things that happened which no other field can hold.
 *
 * "The recruiter called." "I chased them." "HR said results by Friday." These
 * are the one genuine event log in the module, and they are one because they
 * are *primary data*: a phone call has no source document to be projected from,
 * unlike a round or a stage change, which are facts the record already holds
 * and the timeline merely renders.
 *
 * `fromThem` is the field doing real work here rather than the kind. Whether
 * the other side started it is what decides your days-to-first-reply, and it is
 * the difference between an application that is quiet because nobody has
 * answered and one that is quiet because you have not chased.
 */
export function TouchpointList({ touchpoints = [], onAdd, onRemove, busy }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('inbound');
  const [note, setNote] = useState('');

  const submit = (event) => {
    event.preventDefault();
    onAdd({
      kind,
      /* Derived rather than asked. Three of the six kinds answer it on their
         own, and a checkbox for the rest is one more thing to tick on a form
         whose whole job is being quick. */
      fromThem: kind === 'inbound' || kind === 'call',
      note: note.trim(),
    });
    setNote('');
    setOpen(false);
  };

  return (
    <section className="ap-touchpoints">
      <header className="ap-section-head">
        <h3>Contact</h3>
        <button type="button" className="btn sm" onClick={() => setOpen((value) => !value)}>
          <IconPlus size={11} />
          Add
        </button>
      </header>

      {open && (
        <form className="ap-touch-add" onSubmit={submit}>
          <Dropdown
            ariaLabel="What happened"
            value={kind}
            options={TOUCHPOINT_OPTIONS}
            onChange={setKind}
          />
          <input
            autoFocus
            value={note}
            maxLength={2000}
            placeholder="What was said"
            onChange={(event) => setNote(event.target.value)}
          />
          <button type="submit" className="btn primary sm" disabled={busy}>
            Save
          </button>
        </form>
      )}

      {touchpoints.length ? (
        <ul className="ap-touch-list">
          {touchpoints.map((touchpoint) => (
            <li key={touchpoint.id} className={touchpoint.fromThem ? 'is-inbound' : ''}>
              <i className="ap-dot" aria-hidden="true" />
              <span className="ap-touch-kind">{touchpointLabel(touchpoint.kind)}</span>
              {touchpoint.note && <span className="ap-touch-note">{touchpoint.note}</span>}
              <time className="ap-muted">{stamp(touchpoint.at)}</time>
              <button
                type="button"
                className="icon-btn"
                title="Remove"
                disabled={busy}
                onClick={() => onRemove(touchpoint.id)}
              >
                <IconTrash size={11} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        !open && <p className="ap-muted ap-empty-line">Nothing logged yet.</p>
      )}
    </section>
  );
}
