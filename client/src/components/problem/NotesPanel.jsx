import { useCallback, useEffect, useRef, useState } from 'react';

/*
  Long on purpose. A note gets written in bursts, and a short debounce turned
  every pause for thought into a request — so the write waits until you have
  actually stopped. Nothing is at risk from the wait: leaving the field and
  closing the panel both flush whatever is still pending.
*/
const AUTOSAVE_MS = 5000;

const LABEL = { saved: 'Saved', dirty: 'Unsaved', saving: 'Saving…' };

/**
 * Inline notes. Autosaves once you stop typing — no Save button, no modal,
 * because a dialog per note is exactly the form-filling this app is meant to
 * avoid.
 */
export function NotesPanel({ progress, onSave, onDelete }) {
  const [text, setText] = useState(progress?.notes || '');
  const [state, setState] = useState('saved');
  const confidence = progress?.confidence ?? 3;
  const timer = useRef(null);
  const area = useRef(null);
  // Closing the panel unmounts us mid-debounce, so the pending value and the
  // save fn are mirrored into refs and flushed on the way out.
  const pending = useRef(null);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (pending.current === null) return;
    const value = pending.current;
    pending.current = null;
    setState('saving');
    // Resolves when the write lands, so "Saving…" covers the request rather
    // than flipping to "Saved" on optimism. After unmount both are no-ops.
    Promise.resolve(saveRef.current({ notes: value })).then(() => setState('saved'));
  }, []);

  useEffect(() => {
    area.current?.focus();
    const el = area.current;
    if (el) el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  useEffect(() => flush, [flush]);

  const onChange = (value) => {
    setText(value);
    setState('dirty');
    pending.current = value;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, AUTOSAVE_MS);
  };

  return (
    <div className="notes-box">
      <textarea
        ref={area}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        // Clicking away is you saying you are done — no reason to sit on the
        // note for the rest of the debounce.
        onBlur={flush}
        placeholder="Approach, edge cases, why you got stuck..."
        spellCheck="false"
      />
      <div className="notes-foot">
        <span className="confidence" title="How confident are you on this one?">
          Confidence
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              className={`conf-dot ${n <= confidence ? 'on' : ''}`}
              onClick={() => onSave({ confidence: n })}
              title={`${n} of 5 — drives how soon this comes back for revision`}
              aria-label={`Confidence ${n} of 5`}
            />
          ))}
        </span>
        <span className={`notes-state ${state}`}>{LABEL[state]}</span>
        {onDelete && (
          <button className="link-btn notes-delete" onClick={onDelete}>
            Delete problem
          </button>
        )}
      </div>
    </div>
  );
}
