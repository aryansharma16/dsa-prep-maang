import { useState } from 'react';
import { useRoadmap } from '../../store/RoadmapContext.jsx';
import { IconClock, IconClose, IconFlag, IconNote, IconRotate } from '../ui/Icons.jsx';
import { AttemptPopover } from './AttemptPopover.jsx';
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
  const { setProgress, logAttempt, removeProblem } = useRoadmap();
  const [popover, setPopover] = useState(false);
  const progress = problem.progress || {};
  const status = progress.status || 'todo';

  // Built here rather than in the registry so the popover can stay row state —
  // the actions column is the one cell that owns something of its own.
  const actions = (
    <>
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

        <button
          className={`act ${popover ? 'on' : ''}`}
          title="Log an attempt"
          onClick={() => setPopover((v) => !v)}
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
      </span>

      {popover && (
        <AttemptPopover
          onClose={() => setPopover(false)}
          onSubmit={(body) => logAttempt(problem._id, body)}
        />
      )}
    </>
  );

  const rowClass = [
    isCursor && 'cursor',
    status === 'solved' && 'solved',
    isPicked && 'picked',
    // The popover lives inside a frozen cell, which shares a z-index with every
    // other frozen cell — see the lift this class buys it in app.css.
    popover && 'pop-open',
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
              onDelete={problem.source === 'custom' ? () => removeProblem(problem._id) : undefined}
            />
          </td>
        </tr>
      )}
    </>
  );
}
