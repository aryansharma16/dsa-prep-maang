import { useRef, useState } from 'react';

import { Dropdown } from '../ui/Dropdown.jsx';
import { Modal } from '../ui/Modal.jsx';
import { TagInput } from '../ui/TagInput.jsx';
import { dateTimeFromInput, dateTimeInputValue } from './time.js';
import { MODE_OPTIONS, OUTCOME_OPTIONS, ROUND_TYPE_OPTIONS, outcomeSettled } from './vocab.js';

/**
 * One round's details.
 *
 * Add and edit are the same component — `const editing = Boolean(round)`, the
 * house convention — because the fields are identical and a second dialog is a
 * pair that drifts on the first field added to one of them.
 *
 * Only the type has a default, and it is `recruiter_screen` because the first
 * round of nearly every loop is somebody from HR on a phone. Everything else
 * starts empty: a duration that defaulted to sixty minutes would record an hour
 * for every round you did not time, and a mode that defaulted to "video" would
 * quietly assert something about rounds you sat in an office.
 */
export function RoundModal({ round, onSave, onClose }) {
  const editing = Boolean(round);
  const firstRef = useRef(null);

  const [type, setType] = useState(round?.type || 'recruiter_screen');
  const [label, setLabel] = useState(round?.label || '');
  const [scheduledAt, setScheduledAt] = useState(dateTimeInputValue(round?.scheduledAt));
  const [durationMinutes, setDuration] = useState(
    round?.durationMinutes == null ? '' : String(round.durationMinutes),
  );
  const [mode, setMode] = useState(round?.mode || '');
  const [outcome, setOutcome] = useState(round?.outcome || 'scheduled');
  const [interviewers, setInterviewers] = useState(
    (round?.interviewers || []).map((person) =>
      [person.name, person.title].filter(Boolean).join(' — '),
    ),
  );
  const [notes, setNotes] = useState(round?.notes || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      await onSave({
        type,
        label: label.trim(),
        scheduledAt: scheduledAt ? dateTimeFromInput(scheduledAt) : null,
        durationMinutes: durationMinutes === '' ? null : Number(durationMinutes),
        mode,
        outcome,
        /*
          One text field, split on the dash. A name and a title are two facts
          and the schema keeps them apart, but asking for them in two inputs per
          interviewer — times four on a panel — is a form nobody fills in. Typed
          as one line it costs nothing to leave the title off.
        */
        interviewers: interviewers.map((entry) => {
          const [name, ...rest] = entry.split('—');
          return { name: name.trim(), title: rest.join('—').trim() };
        }),
        notes,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'That did not save');
      setBusy(false);
    }
  };

  return (
    <Modal
      title={editing ? 'Edit round' : 'Add a round'}
      size="lg"
      onClose={onClose}
      initialFocus={firstRef}
    >
      <form onSubmit={submit}>
        <div className="modal-body">
          <div className="field-row">
            <label className="field">
              <span>What kind</span>
              <Dropdown
                ariaLabel="Round type"
                value={type}
                options={ROUND_TYPE_OPTIONS}
                onChange={setType}
                searchable
              />
            </label>
            <label className="field">
              <span>What they called it</span>
              <input
                ref={firstRef}
                value={label}
                maxLength={80}
                placeholder="Round 2, Onsite Panel A…"
                onChange={(event) => setLabel(event.target.value)}
              />
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              <span>When</span>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
              />
              <span className="field-hint">
                Leave it empty for an assessment you have a window to sit.
              </span>
            </label>
            <label className="field">
              <span>How long</span>
              <input
                type="number"
                min={0}
                max={600}
                value={durationMinutes}
                placeholder="Minutes"
                onChange={(event) => setDuration(event.target.value)}
              />
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              <span>Where</span>
              <Dropdown
                ariaLabel="Round mode"
                value={mode}
                options={MODE_OPTIONS}
                onChange={setMode}
              />
            </label>
            <label className="field">
              <span>How it went</span>
              <Dropdown
                ariaLabel="Outcome"
                value={outcome}
                options={OUTCOME_OPTIONS}
                onChange={setOutcome}
              />
              {/*
                Moving a round to a new date is not an outcome and never changes
                this — the reschedule records itself on the round and the round
                stays scheduled. Said here because the dropdown is where people
                look for somewhere to put it.
              */}
              {!outcomeSettled(outcome) && (
                <span className="field-hint">
                  Rescheduling is not an outcome — just change the date.
                </span>
              )}
            </label>
          </div>

          <label className="field">
            <span>Who was on it</span>
            <TagInput
              value={interviewers}
              onChange={setInterviewers}
              placeholder="Name — their title, then Enter"
            />
          </label>

          <label className="field">
            <span>Notes</span>
            <textarea
              rows={4}
              value={notes}
              maxLength={4000}
              placeholder="How the room felt, what they seemed to care about, anything to remember for the next one."
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>

          {error && <div className="alert">{error}</div>}
        </div>

        <div className="modal-foot">
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save' : 'Add round'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
