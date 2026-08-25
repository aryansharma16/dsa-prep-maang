import { useState } from 'react';
import { useAttemptTimer } from '../../store/AttemptTimerContext.jsx';
import { useRoadmap } from '../../store/RoadmapContext.jsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx';
import { IconClock, IconClose, IconEdit, IconFlag, IconNote, IconRotate } from '../ui/Icons.jsx';
import { AddProblemModal } from './AddProblemModal.jsx';
import { AttemptModal } from './AttemptModal.jsx';
import { NotesPanel } from './NotesPanel.jsx';
import { Statement } from './Statement.jsx';
import { cellProps } from './cellProps.js';

export function ProblemRow({
  problem,
  index,
  columns,
  isCursor,
  isPicked,
  onFocus,
  notesOpen,
  onToggleNotes,
}) {
  const { setProgress, removeProblem } = useRoadmap();
  const timer = useAttemptTimer();
  const [logging, setLogging] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const progress = problem.progress || {};
  const status = progress.status || 'todo';

  /*
    Yours to change, as the server decided — not `source === 'custom'`, which is
    what this used to ask. A LeetCode problem you added is `source: 'leetcode'`
    and every bit as much yours, so that test hid the delete button on half of
    anyone's own additions. The seeded curriculum has no owner and so never
    offers either control.
  */
  const mine = Boolean(problem.mine);

  // Built here rather than in the registry: the buttons act on row state — the
  // dialogs below open from them — and the registry only knows about columns.
  const actions = (
    <span className="acts">
      <button
        className={`act ${progress.flagged ? 'on' : ''}`}
        title={progress.flagged ? 'Unflag' : 'Flag this problem'}
        onClick={() => setProgress(problem._id, { flagged: !progress.flagged })}
      >
        <IconFlag size={13} filled={progress.flagged} />
      </button>

      <button
        className={`act rev ${progress.needsRevision ? 'on' : ''}`}
        title={progress.needsRevision ? 'Clear revision flag' : 'Needs revision'}
        onClick={() => setProgress(problem._id, { needsRevision: !progress.needsRevision })}
      >
        <IconRotate size={13} />
      </button>

      {/* The clock marks itself while it is this row being timed, so the
          table says which problem the pill in the top bar is counting. */}
      <button
        className={`act ${logging || timer.isOn(problem._id) ? 'on' : ''} ${
          timer.isOn(problem._id) && timer.running ? 'ticking' : ''
        }`}
        title={timer.isOn(problem._id) ? 'Timing this one — log the attempt' : 'Log an attempt'}
        onClick={() => setLogging(true)}
      >
        <IconClock size={13} />
      </button>

      {/* Open, the button turns into the way out. The note icon staying put
          gave no sign the second click was the one that closed it. */}
      <button
        className={`act note ${progress.notes ? 'on' : ''} ${notesOpen ? 'shut' : ''}`}
        title={notesOpen ? 'Close notes' : 'Notes'}
        onClick={onToggleNotes}
      >
        {notesOpen ? (
          <IconClose size={13} />
        ) : (
          <IconNote size={13} filled={Boolean(progress.notes)} />
        )}
      </button>

      {/* Last, and only on your own rows. The four above act on your progress
          and exist for every problem; this one acts on the problem itself. */}
      {mine && (
        <button
          className="act"
          title="Edit this problem"
          onClick={() => setEditing(true)}
        >
          <IconEdit size={13} />
        </button>
      )}
    </span>
  );

  const rowClass = [
    isCursor && 'cursor',
    status === 'solved' && 'solved',
    isPicked && 'picked',
    timer.isOn(problem._id) && 'timing',
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
            })}
          </td>
        ))}
      </tr>

      {notesOpen && (
        <tr className="notes-row">
          <td colSpan={columns.length}>
            <Statement slug={problem.slug} source={problem.source} />
            <NotesPanel
              progress={progress}
              onSave={(patch) => setProgress(problem._id, patch)}
              onDelete={mine ? () => setDeleting(true) : undefined}
            />
          </td>
        </tr>
      )}

      {logging && <AttemptModal problem={problem} onClose={() => setLogging(false)} />}

      {editing && <AddProblemModal problem={problem} onClose={() => setEditing(false)} />}

      {/* Confirmed, unlike the progress toggles above it. Those are one click to
          undo; this takes the problem and every attempt logged against it. */}
      {deleting && (
        <ConfirmDialog
          title="Delete this problem?"
          message={`"${problem.title}" goes from your roadmap.`}
          detail="Your notes, status and logged attempts for it go too. This cannot be undone — nobody else's copy is affected."
          confirmLabel="Delete"
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
