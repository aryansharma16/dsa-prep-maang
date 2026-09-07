import { useState } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { REVISION_FLAGS, REVISION_NOTE_MAX } from './revisionFlags.js';

/**
 * Raising the revision flag, with the reason attached.
 *
 * The flag used to be a one-click boolean, and by the time the row came back it
 * was a title with nothing behind it. "I flagged this for something" is not a
 * thing you can act on three weeks later, and the queue was full of them — some
 * meaning "I ran out of Tuesday", some meaning "I do not know what a monotonic
 * stack is". Those are different mornings' work and they looked identical.
 *
 * So the flag carries a category and a line. Both optional, deliberately: the
 * dialog opens with nothing selected and the button works anyway, because a flag
 * you cannot be bothered to explain is still worth more than no flag. The `r`
 * shortcut on the roadmap skips this entirely for the same reason — you are
 * mid-problem, and a dialog is not what you want at minute forty.
 *
 * Used by all three problem rows. The three collections have different progress
 * endpoints behind them and identical flags, so this takes an `onSave` and knows
 * about neither.
 *
 * @param progress  the row's progress, for the flag that may already be on it
 * @param onSave    called with the patch — `{ needsRevision, revisionReason,
 *                  revisionNote }` — and awaited only for the dialog to close
 */
export function RevisionFlagModal({ title, progress = {}, onSave, onClose }) {
  const flagged = Boolean(progress.needsRevision);
  const [reason, setReason] = useState(progress.revisionReason || '');
  const [note, setNote] = useState(progress.revisionNote || '');

  const save = () => {
    onSave({
      needsRevision: true,
      revisionReason: reason,
      revisionNote: note.trim().slice(0, REVISION_NOTE_MAX),
    });
    onClose();
  };

  const clear = () => {
    // The server drops the reason and the line with the flag — see
    // patchProgress. Sent as one field rather than three so that rule stays in
    // one place.
    onSave({ needsRevision: false });
    onClose();
  };

  return (
    <Modal
      title={`${flagged ? 'Flagged for revision' : 'Flag for revision'} — ${title}`}
      size="sm"
      onClose={onClose}
    >
      <div className="modal-body rf-body">
        <section className="rf-block">
          <h4>Why is it coming back?</h4>
          <div className="chips rf-reasons">
            {REVISION_FLAGS.map((flag) => (
              <button
                key={flag.value}
                type="button"
                className={`chip ${reason === flag.value ? 'on' : ''}`}
                onClick={() => setReason(reason === flag.value ? '' : flag.value)}
                title={flag.hint}
              >
                {flag.label}
              </button>
            ))}
          </div>
          {/* The chip's own sentence, under the row rather than only in a
              tooltip — the difference between the six is the whole reason for
              asking, and a tooltip is not where that gets read. */}
          <p className="rf-hint">
            {REVISION_FLAGS.find((f) => f.value === reason)?.hint ||
              'Optional. A flag with no reason is still a flag.'}
          </p>
        </section>

        <section className="rf-block">
          <h4>What do you want to remember?</h4>
          <textarea
            className="rf-note"
            value={note}
            maxLength={REVISION_NOTE_MAX}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Come back for the O(n) one — the heap version is in the notes…"
            spellCheck="false"
          />
          {/* One line, and it says so. The long version belongs in the
              problem's notes, which hold forty times as much. */}
          <p className="rf-hint">
            One line, for the version of you that opens the queue in three weeks.
          </p>
        </section>
      </div>

      <div className="modal-foot">
        {flagged && (
          <button type="button" className="link-btn danger" onClick={clear}>
            Clear the flag
          </button>
        )}
        <span className="spacer" />
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn primary" onClick={save}>
          {flagged ? 'Save' : 'Flag it'}
        </button>
      </div>
    </Modal>
  );
}
