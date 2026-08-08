import { useState } from 'react';
import { useRoadmap } from '../../store/RoadmapContext.jsx';
import {
  IconCheck,
  IconClock,
  IconExternal,
  IconFlag,
  IconNote,
  IconRotate,
} from '../ui/Icons.jsx';
import { AttemptPopover } from './AttemptPopover.jsx';
import { CompanyChips } from './CompanyChips.jsx';
import { NotesPanel } from './NotesPanel.jsx';
import { Statement } from './Statement.jsx';

const NEXT_STATUS = { todo: 'attempted', attempted: 'solved', solved: 'todo' };
const STATUS_LABEL = {
  todo: 'Not started — click to mark attempted',
  attempted: 'Attempted — click to mark solved',
  solved: 'Solved — click to reset',
};

const SHEET_LABEL = {
  'striver-sde': 'SDE',
  'neetcode-150': 'NC150',
  'blind-75': 'B75',
};

export function ProblemRow({ problem, index, isCursor, onFocus, notesOpen, onToggleNotes }) {
  const { setProgress, logAttempt, removeProblem } = useRoadmap();
  const [popover, setPopover] = useState(false);
  const p = problem.progress || {};
  const status = p.status || 'todo';

  const badge = problem.sheets?.find((s) => SHEET_LABEL[s.sheet]);

  return (
    <>
      <tr
        data-row={problem._id}
        className={`${isCursor ? 'cursor' : ''} ${status === 'solved' ? 'solved' : ''}`}
        onMouseDown={onFocus}
      >
        <td className="col-status">
          <button
            className={`status-btn ${status}`}
            title={STATUS_LABEL[status]}
            aria-label={STATUS_LABEL[status]}
            onClick={() => setProgress(problem._id, { status: NEXT_STATUS[status] })}
          >
            {status === 'solved' && <IconCheck size={11} />}
          </button>
        </td>

        <td className="col-num">{String(index + 1).padStart(2, '0')}</td>

        <td>
          <div className="title-cell">
            <a
              className="title-link"
              href={problem.url || problem.articleUrl || '#'}
              target="_blank"
              rel="noreferrer"
              title={problem.title}
            >
              {problem.title}
            </a>
            <span className="ext">
              <IconExternal size={11} />
            </span>
            {badge && <span className="tag-mini">{SHEET_LABEL[badge.sheet]}</span>}
            {problem.source === 'custom' && <span className="tag-mini">MINE</span>}
            {problem.source === 'gfg' && <span className="tag-mini">GFG</span>}
          </div>
        </td>

        <td className="col-diff">
          <span className={`diff ${problem.difficulty}`}>{problem.difficulty}</span>
        </td>

        <td className="col-cos">
          <CompanyChips companies={problem.companies} />
        </td>

        <td className="col-acts" style={{ position: 'relative' }}>
          <span className="acts">
            <button
              className={`act ${p.flagged ? 'on' : ''}`}
              title={p.flagged ? 'Unflag' : 'Flag this problem'}
              onClick={() => setProgress(problem._id, { flagged: !p.flagged })}
            >
              <IconFlag size={13} filled={p.flagged} />
            </button>

            <button
              className={`act rev ${p.needsRevision ? 'on' : ''}`}
              title={p.needsRevision ? 'Clear revision flag' : 'Needs revision'}
              onClick={() => setProgress(problem._id, { needsRevision: !p.needsRevision })}
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

            <button
              className={`act note ${p.notes ? 'on' : ''}`}
              title={notesOpen ? 'Hide notes' : 'Notes'}
              onClick={onToggleNotes}
            >
              <IconNote size={13} filled={Boolean(p.notes)} />
            </button>
          </span>

          {popover && (
            <AttemptPopover
              onClose={() => setPopover(false)}
              onSubmit={(body) => logAttempt(problem._id, body)}
            />
          )}
        </td>
      </tr>

      {notesOpen && (
        <tr className="notes-row">
          <td colSpan={6}>
            <Statement slug={problem.slug} source={problem.source} />
            <NotesPanel
              progress={p}
              onSave={(patch) => setProgress(problem._id, patch)}
              onDelete={
                problem.source === 'custom'
                  ? () => removeProblem(problem._id)
                  : undefined
              }
            />
          </td>
        </tr>
      )}
    </>
  );
}
