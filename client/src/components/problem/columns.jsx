import { IconCheck, IconClock, IconExternal, IconNote, IconPlay } from '../ui/Icons.jsx';
import { attemptTitle, minutesLabel, outcomeOf } from './attempts.js';
import { CompanyChips } from './CompanyChips.jsx';
import { EditorialLink } from './EditorialLink.jsx';

/**
 * Every column the problems table can show, in default order.
 *
 * `width` is the width the column was designed at — the M preset. The other
 * presets scale off it, so a size means the same thing on every column without
 * anyone having to pick pixel values per column.
 *
 * `cell` gets the row context assembled in ProblemRow, so a column can read the
 * problem, the caller's progress on it, and the row's own handlers.
 */

/*
  The title-cell badge shows the *first* of these a problem belongs to, so the
  order of this object is the priority order. `ai-300` is last on purpose: it
  overlaps the other four heavily, and a problem that was reading SDE or B75
  yesterday should not start reading AI today. It only ever shows on the 39
  problems the AI sheet picked that are on no other list.
*/
const SHEET_LABEL = {
  'striver-sde': 'SDE',
  'neetcode-150': 'NC150',
  'blind-75': 'B75',
  'faang-2026': 'FAANG',
  'sheet-150': 'S150',
  'ai-300': 'AI',
  // After everything else, so they never replace a problem's existing badge;
  // sprint membership gets its own chip in the title cell instead.
  'sprint-300': 'S300',
  'kit-360': 'KIT',
};

const STATUS_LABEL = {
  todo: 'Not started — click to mark attempted',
  attempted: 'Attempted — click to mark solved',
  solved: 'Solved — click to reset',
};

const NEXT_STATUS = { todo: 'attempted', attempted: 'solved', solved: 'todo' };

const compact = (n) => {
  if (!n) return '—';
  if (n >= 1000) return `${Math.round(n / 100) / 10}k`;
  return String(n);
};

const shortDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
};

// "in 5d" / "today" / "3d ago" reads faster than a date when the only question
// is whether this is due.
const relativeDays = (value) => {
  if (!value) return '—';
  const days = Math.round((new Date(value) - Date.now()) / 86400000);
  if (days === 0) return 'today';
  if (days > 0) return `in ${days}d`;
  return `${-days}d ago`;
};

const Empty = () => <span className="cell-empty">—</span>;

export const COLUMNS = [
  {
    id: 'status',
    label: 'Done',
    width: 40,
    fixed: true,
    className: 'col-status',
    head: '',
    cell: ({ status, setProgress, problem }) => (
      <button
        className={`status-btn ${status}`}
        title={STATUS_LABEL[status]}
        aria-label={STATUS_LABEL[status]}
        onClick={() => setProgress(problem._id, { status: NEXT_STATUS[status] })}
      >
        {status === 'solved' && <IconCheck size={11} />}
      </button>
    ),
  },
  {
    id: 'index',
    label: '#',
    width: 42,
    fixed: true,
    className: 'cell-mono cell-dim',
    cell: ({ index }) => String(index + 1).padStart(2, '0'),
  },
  {
    id: 'lcId',
    label: 'LC #',
    width: 58,
    hidden: true,
    className: 'cell-mono cell-dim',
    cell: ({ problem }) => (problem.lcId ? problem.lcId : <Empty />),
  },
  {
    id: 'title',
    label: 'Problem',
    width: 340,
    required: true,
    grow: true,
    cell: ({ problem }) => {
      const badge = problem.sheets?.find((s) => SHEET_LABEL[s.sheet]);
      return (
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
          {/* Ownership, not source. A LeetCode problem you added is
              `source: 'leetcode'` and still yours, and keying this off source
              left half of anyone's own additions looking seeded. */}
          {badge?.sheet !== 'sprint-300' && problem.sheets?.some((s) => s.sheet === 'sprint-300') && (
            <span className="tag-mini sprint" title="In the 30-day Sprint 300">
              S300
            </span>
          )}
          {problem.mine && <span className="tag-mini">MINE</span>}
          {problem.source === 'gfg' && <span className="tag-mini">GFG</span>}
        </div>
      );
    },
  },
  {
    id: 'difficulty',
    label: 'Difficulty',
    width: 84,
    cell: ({ problem }) => <span className={`diff ${problem.difficulty}`}>{problem.difficulty}</span>,
  },
  {
    id: 'companies',
    label: 'Asked at',
    width: 200,
    // Fits as many logos as the width allows instead of a fixed three, so making
    // the column wider actually buys you something.
    cell: ({ problem, width }) => (
      <CompanyChips companies={problem.companies} max={Math.max(1, Math.floor((width - 34) / 22))} />
    ),
  },
  {
    /*
      Who asked it lately, which is not the column above.

      'Asked at' draws logos weighted by a measured frequency with no date on
      it; this draws names reported in 2025-26 interviews and no frequency at
      all. They are different claims about different years, so they are
      different columns — collapsing them would let a 2019 tag and a 2026 report
      render identically. Names rather than logos because half of these
      companies (OpenAI, Anthropic, Databricks, Stripe) have no logo seeded.
    */
    id: 'askedRecently',
    label: 'Asked 2025-26',
    width: 190,
    hidden: true,
    cell: ({ problem }) =>
      problem.askedRecently?.length ? (
        <div className="chip-row" title={problem.askedRecently.join(', ')}>
          {problem.askedRecently.map((c) => (
            <span className="topic-chip" key={c}>
              {c}
            </span>
          ))}
        </div>
      ) : (
        <Empty />
      ),
  },
  {
    id: 'topics',
    label: 'Topics',
    width: 190,
    cell: ({ problem }) =>
      problem.topicTags?.length ? (
        <div className="chip-row" title={problem.topicTags.join(', ')}>
          {problem.topicTags.map((t) => (
            <span className="topic-chip" key={t}>
              {t}
            </span>
          ))}
        </div>
      ) : (
        <Empty />
      ),
  },
  {
    id: 'sheets',
    label: 'Sheets',
    width: 130,
    hidden: true,
    cell: ({ problem }) =>
      problem.sheets?.length ? (
        <div className="chip-row" title={problem.sheets.map((s) => s.group).join(' · ')}>
          {problem.sheets.map((s) => (
            <span className="tag-mini" key={s.sheet}>
              {SHEET_LABEL[s.sheet] || s.sheet}
            </span>
          ))}
        </div>
      ) : (
        <Empty />
      ),
  },
  {
    id: 'sheetGroup',
    label: 'Sheet section',
    width: 150,
    hidden: true,
    className: 'cell-dim cell-truncate',
    // Striver names his days ("Day 4: Arrays Part-IV"); NeetCode names patterns.
    cell: ({ problem }) => {
      const group = problem.sheets?.find((s) => s.group)?.group;
      return group ? <span title={group}>{group}</span> : <Empty />;
    },
  },
  {
    id: 'likes',
    label: 'Likes',
    width: 66,
    hidden: true,
    className: 'cell-mono cell-dim',
    cell: ({ problem }) => compact(problem.likes),
  },
  {
    id: 'likeRatio',
    label: 'Liked',
    width: 66,
    hidden: true,
    className: 'cell-mono',
    // Under 70% is the community saying the problem is badly specified.
    cell: ({ problem }) =>
      problem.likeRatio ? (
        <span className={problem.likeRatio < 70 ? 'ratio bad' : 'ratio'}>
          {Math.round(problem.likeRatio)}%
        </span>
      ) : (
        <Empty />
      ),
  },
  {
    id: 'score',
    label: 'Score',
    width: 62,
    hidden: true,
    className: 'cell-mono cell-dim',
    // The curation score: company demand plus sheet weight. It is why the
    // problem made the list at all, so it is worth being able to see.
    cell: ({ problem }) => (problem.score ? problem.score.toFixed(1) : <Empty />),
  },
  {
    id: 'statusText',
    label: 'Status',
    width: 90,
    hidden: true,
    cell: ({ status }) => <span className={`status-pill ${status}`}>{status}</span>,
  },
  {
    id: 'confidence',
    label: 'Confidence',
    width: 92,
    hidden: true,
    cell: ({ progress, status }) =>
      status === 'todo' ? (
        <Empty />
      ) : (
        <span className="conf" title={`${progress.confidence || 3} of 5`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <i key={n} className={n <= (progress.confidence || 3) ? 'on' : ''} />
          ))}
        </span>
      ),
  },
  {
    id: 'attempts',
    // "Tries", because the column below it is the one called Attempts now. Two
    // entries with the same name in the Columns dialog is a coin toss.
    label: 'Tries',
    width: 66,
    hidden: true,
    className: 'cell-mono cell-dim',
    cell: ({ progress }) => progress.attemptCount || <Empty />,
  },
  {
    id: 'attemptLog',
    label: 'Attempts',
    width: 186,
    /*
      A chip per sitting, newest last, read the way the companies and topics
      columns are read — as a shape rather than a number. Three attempts ending
      in green is a different problem from three ending in red, and the count
      column beside it cannot tell them apart.

      Visible by default, unlike almost everything else here. The chips are the
      reason the log is worth keeping, and a feature nobody switches on is a
      feature nobody has. Anyone who disagrees turns it off in Columns, and a
      layout saved before this existed picks it up at its default position — see
      reconcile() in hooks/useTableLayout.js.
    */
    cell: ({ progress, problem, width }) => {
      const attempts = progress.recentAttempts || [];
      if (!attempts.length) return <Empty />;

      // The chips are ~46px each. Show what fits, and say how many are behind
      // the ones shown rather than silently cutting the history off.
      const max = Math.max(1, Math.floor((width - 30) / 46));
      const shown = attempts.slice(-max);
      const hidden = (progress.attemptCount || attempts.length) - shown.length;

      return (
        <div className="att-cell" title={`${problem.title}\n\n${attempts.map(attemptTitle).join('\n\n')}`}>
          {shown.map((attempt, i) => (
            <span
              key={attempt._id || `${attempt.at}-${i}`}
              className={`att-chip ${outcomeOf(attempt.outcome).tone}`}
              data-hue={attempt.color || undefined}
            >
              {attempt.timed && <IconClock size={9} />}
              {minutesLabel(attempt.minutes)}
              {attempt.note && <i className="att-chip-note" />}
            </span>
          ))}
          {hidden > 0 && <span className="att-chip-more">+{hidden}</span>}
        </div>
      );
    },
  },
  {
    id: 'timeSpent',
    label: 'Time spent',
    width: 88,
    hidden: true,
    className: 'cell-mono cell-dim',
    // Every minute ever logged against it. The one number that answers "is this
    // problem expensive", which neither the count nor the last attempt does.
    cell: ({ progress }) =>
      progress.attemptMinutes ? minutesLabel(progress.attemptMinutes) : <Empty />,
  },
  {
    id: 'solvedAt',
    label: 'Solved',
    width: 82,
    hidden: true,
    className: 'cell-mono cell-dim',
    cell: ({ progress }) => shortDate(progress.solvedAt),
  },
  {
    id: 'nextReview',
    label: 'Next review',
    width: 96,
    hidden: true,
    className: 'cell-mono cell-dim',
    cell: ({ progress }) => relativeDays(progress.nextReviewAt),
  },
  {
    id: 'notes',
    label: 'Notes',
    width: 200,
    hidden: true,
    className: 'cell-truncate cell-dim',
    cell: ({ progress, onToggleNotes }) =>
      progress.notes ? (
        <button className="notes-peek" title={progress.notes} onClick={onToggleNotes}>
          <IconNote size={11} filled />
          {progress.notes.replace(/\s+/g, ' ').trim()}
        </button>
      ) : (
        <Empty />
      ),
  },
  {
    id: 'video',
    label: 'Video',
    width: 62,
    hidden: true,
    /* Gated. A walkthrough is somebody else's answer just as much as the
       editorial is — see EditorialLink. */
    cell: ({ problem, progress }) =>
      problem.videoId ? (
        <EditorialLink
          problem={problem}
          progress={progress}
          href={`https://www.youtube.com/watch?v=${problem.videoId}`}
          title="Watch the walkthrough"
        >
          <IconPlay size={12} />
        </EditorialLink>
      ) : (
        <Empty />
      ),
  },
  {
    id: 'article',
    label: 'Article',
    width: 66,
    hidden: true,
    cell: ({ problem, progress }) =>
      problem.articleUrl ? (
        <EditorialLink
          problem={problem}
          progress={progress}
          href={problem.articleUrl}
          title={problem.articleUrl}
        >
          <IconExternal size={12} />
        </EditorialLink>
      ) : (
        <Empty />
      ),
  },
  {
    id: 'source',
    label: 'Source',
    width: 78,
    hidden: true,
    className: 'cell-dim',
    cell: ({ problem }) => ({ leetcode: 'LeetCode', gfg: 'GFG', custom: 'Mine' })[problem.source],
  },
  {
    id: 'actions',
    label: 'Track',
    // Four 24px buttons, their gaps, and the cell padding. It used to be
    // narrower and simply spilled into the next column; frozen against the
    // right edge there is nothing to spill into, so it has to actually fit.
    width: 128,
    fixed: true,
    className: 'col-acts',
    cell: ({ actions }) => actions,
  },
];

export const COLUMN_BY_ID = Object.fromEntries(COLUMNS.map((c) => [c.id, c]));

export const SIZES = ['XS', 'S', 'M', 'L', 'XL'];

// Relative to each column's designed width, so one setting reads the same way
// on a 42px number column and a 340px title column.
const SCALE = { XS: 0.6, S: 0.8, M: 1, L: 1.35, XL: 1.8 };

export const widthOf = (column, size) => Math.round(column.width * (SCALE[size] ?? 1));
