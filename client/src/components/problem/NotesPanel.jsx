import { useEffect, useRef, useState } from 'react';

const AUTOSAVE_MS = 700;

/**
 * Inline notes. Autosaves while you type — no Save button, no modal, because
 * a dialog per note is exactly the form-filling this app is meant to avoid.
 */
export function NotesPanel({ progress, onSave, onDelete }) {
  const [text, setText] = useState(progress?.notes || '');
  const [saved, setSaved] = useState(true);
  const confidence = progress?.confidence ?? 3;
  const timer = useRef(null);
  const area = useRef(null);
  // Closing the panel unmounts us mid-debounce, so the pending value and the
  // save fn are mirrored into refs and flushed on the way out.
  const pending = useRef(null);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  useEffect(() => {
    area.current?.focus();
    const el = area.current;
    if (el) el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (pending.current !== null) saveRef.current({ notes: pending.current });
    },
    [],
  );

  const onChange = (value) => {
    setText(value);
    setSaved(false);
    pending.current = value;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      pending.current = null;
      onSave({ notes: value });
      setSaved(true);
    }, AUTOSAVE_MS);
  };

  return (
    <div className="notes-box">
      <textarea
        ref={area}
        value={text}
        onChange={(e) => onChange(e.target.value)}
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
        <span>{saved ? 'Saved' : 'Saving...'}</span>
        {onDelete && (
          <button
            className="link-btn"
            style={{ marginLeft: 'auto', color: 'var(--hard)' }}
            onClick={onDelete}
          >
            Delete problem
          </button>
        )}
      </div>
    </div>
  );
}
