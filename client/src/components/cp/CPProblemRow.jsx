import { useMemo, useState } from 'react';
import { useAttemptTimer } from '../../store/AttemptTimerContext.jsx';
import { useCP } from '../../store/CPContext.jsx';
import { cpApi } from '../../api/index.js';
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx';
import { IconClock, IconClose, IconFlag, IconNote, IconRotate } from '../ui/Icons.jsx';
import { AttemptModal } from '../problem/AttemptModal.jsx';
import { NotesPanel } from '../problem/NotesPanel.jsx';
import { RevisionFlagModal } from '../problem/RevisionFlagModal.jsx';
import { cellProps } from '../problem/cellProps.js';
import { revisionFlagOf } from '../problem/revisionFlags.js';

/**
 * One row of the ladder.
 *
 * A twin of ProblemRow rather than a shared component, and the reason is that
 * almost none of it would survive being made generic: it reads a different
 * store, its columns come from a different registry, its delete copy is about a
 * ladder, and it has an affordance ProblemRow does not — the "accepted on the
 * judge but never logged" prompt. What *is* shared is everything expensive:
 * the attempt dialog, the notes panel, the cell-props helper and the column
 * mechanics.
 */
export function CPProblemRow({
  problem,
  index,
  columns,
  isCursor,
  isPicked,
  onFocus,
  notesOpen,
  onToggleNotes,
  tierLabel,
  patternName,
}) {
  const { setProgress, removeProblem, logAttempt, editAttempt, deleteAttempt } = useCP();
  const timer = useAttemptTimer();
  const [logging, setLogging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [flagging, setFlagging] = useState(false);

  const progress = problem.progress || {};
  const status = progress.status || 'todo';
  const mine = Boolean(problem.mine);
  const revisionFlag = revisionFlagOf(progress.revisionReason);

  /*
    The attempt dialog writes through the CP store rather than the roadmap's.
    Memoised because it is otherwise a fresh object on every keystroke in the
    dialog, and the log's fetch effect captures it.
  */
  const store = useMemo(
    () => ({
      logAttempt,
      editAttempt,
      deleteAttempt,
      fetchAttempts: (id) => cpApi.attempts(id),
    }),
    [logAttempt, editAttempt, deleteAttempt],
  );

  const actions = (
    <span className="acts">
      <button
        className={`act ${progress.flagged ? 'on' : ''}`}
        title={progress.flagged ? 'Unflag' : 'Flag this problem'}
        onClick={() => setProgress(problem._id, { flagged: !progress.flagged })}
      >
        <IconFlag size={13} filled={progress.flagged} />
      </button>

      {/* The flag carries a reason and a line — see RevisionFlagModal. `r` on
          the focused row is still the one-click version. */}
      <button
        className={`act rev ${progress.needsRevision ? 'on' : ''}`}
        title={
          progress.needsRevision
            ? `Flagged${revisionFlag ? ` — ${revisionFlag.label}` : ''}${
                progress.revisionNote ? `\n${progress.revisionNote}` : ''
              }`
            : 'Flag for revision'
        }
        onClick={() => setFlagging(true)}
      >
        <IconRotate size={13} />
      </button>

      <button
        className={`act ${logging || timer.isOn(problem._id) ? 'on' : ''} ${
          timer.isOn(problem._id) && timer.running ? 'ticking' : ''
        }`}
        title={timer.isOn(problem._id) ? 'Timing this one — log the attempt' : 'Log an attempt'}
        onClick={() => setLogging(true)}
      >
        <IconClock size={13} />
      </button>

      <button
        className={`act note ${progress.notes ? 'on' : ''} ${notesOpen ? 'shut' : ''}`}
        title={notesOpen ? 'Close notes' : 'Notes'}
        onClick={onToggleNotes}
      >
        {notesOpen ? <IconClose size={13} /> : <IconNote size={13} filled={Boolean(progress.notes)} />}
      </button>
    </span>
  );

  const rowClass = [
    isCursor && 'cursor',
    status === 'solved' && 'solved',
    isPicked && 'picked',
    timer.isOn(problem._id) && 'timing',
    // Codeforces says you solved it and this ladder has no record of it.
    progress.solvedOnPlatform && status !== 'solved' && 'ac-unlogged',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <tr data-row={problem._id} className={rowClass} onMouseDown={onFocus}>
        {columns.map((column) => (
          <td key={column.id} {...cellProps(column)}>
            {column.cell({
              problem,
              index,
              progress,
              status,
              width: column.px,
              setProgress,
              onToggleNotes,
              actions,
              tierLabel,
              patternName,
            })}
          </td>
        ))}
      </tr>

      {notesOpen && (
        <tr className="notes-row">
          <td colSpan={columns.length}>
            {/*
              Why this problem is on the ladder, said in one line. The curation
              note is the difference between a list and a curriculum — "CP-31,
              rating 1400, problem 24 of 31" is a reason to do this one next, and
              a score is not.
            */}
            {problem.curationNote && (
              <p className="cp-curation-note">{problem.curationNote}</p>
            )}

            {progress.solvedOnPlatform && status !== 'solved' && (
              <div className="cp-ac-banner">
                <span>
                  Codeforces has an accepted submission from you
                  {progress.platformSolvedAt
                    ? ` on ${new Date(progress.platformSolvedAt).toLocaleDateString()}`
                    : ''}
                  , but you have not marked it here.
                </span>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setProgress(problem._id, { status: 'solved' })}
                >
                  Mark solved
                </button>
              </div>
            )}

            <NotesPanel
              progress={progress}
              onSave={(patch) => setProgress(problem._id, patch)}
              onDelete={mine ? () => setDeleting(true) : undefined}
            />
          </td>
        </tr>
      )}

      {logging && (
        <AttemptModal problem={problem} store={store} onClose={() => setLogging(false)} />
      )}

      {flagging && (
        <RevisionFlagModal
          title={problem.title}
          progress={progress}
          onSave={(patch) => setProgress(problem._id, patch)}
          onClose={() => setFlagging(false)}
        />
      )}

      {/* Confirmed, unlike the progress toggles above it. Those are one click to
          undo; this takes the problem and every attempt logged against it. */}
      {deleting && (
        <ConfirmDialog
          title="Remove this problem?"
          message={`"${problem.title}" goes from your ladder.`}
          detail="Your notes, status and logged attempts for it go too. This cannot be undone — nobody else's copy is affected."
          confirmLabel="Remove"
          tone="danger"
          onConfirm={() => {
            removeProblem(problem._id);
            setDeleting(false);
          }}
          onCancel={() => setDeleting(false)}
        />
      )}
    </>
  );
}
