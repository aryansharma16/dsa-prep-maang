import { IconCheck, IconClock, IconCode, IconExternal, IconNote, IconPlay } from '../ui/Icons.jsx';
import { attemptTitle, minutesLabel, outcomeOf } from '../problem/attempts.js';
import { ratingKey } from '../../theme/cfRating.js';

/**
 * Every column the CP ladder can show, in default order.
 *
 * A separate registry from the roadmap's rather than a superset of it, because
 * the two tables share almost no columns: a rating, a division, an index letter
 * and a solve count mean nothing on an interview roadmap, and a LeetCode number,
 * a like ratio and a company logo strip mean nothing here. Merging them would
 * produce one list where half the entries render an em dash on any given page.
 *
 * The mechanics are shared — `useTableLayout` takes this registry and does all
 * the reconciling, pinning and sizing. Only the contents are local.
 *
 * `cell` gets the row context assembled in CPProblemRow.
 */

const Empty = () => <span className="cell-empty">—</span>;

/**
 * As many chips as the cell can actually hold, plus a count of the rest.
 *
 * The shared `.chip-row` clips with `overflow: hidden`, which cuts the last chip
 * through the middle of a word — tolerable on the roadmap where tags are one
 * word, and bad here where they are "constructive algorithms" and "data
 * structures". Estimating the width instead means the row ends on a whole chip
 * and says how many it did not show, which is the same contract the companies
 * and attempt-log columns already use.
 *
 * The 6.2px-per-character figure is the rendered width of the 10.5px monospace-
 * adjacent face at this size; 14px is the chip's padding and border. Both are
 * approximations and only decide where the list stops, so being a few pixels out
 * costs nothing.
 */
function fitChips(items, width, reserve = 34) {
  const budget = Math.max(0, width - reserve);
  const shown = [];
  let used = 0;
  for (const item of items) {
    const chip = item.length * 6.2 + 14;
    if (used + chip > budget && shown.length) break;
    shown.push(item);
    used += chip + 4;
  }
  return { shown, hidden: items.length - shown.length };
}

const STATUS_LABEL = {
  todo: 'Not started — click to mark attempted',
  attempted: 'Attempted — click to mark solved',
  solved: 'Solved — click to reset',
};

const NEXT_STATUS = { todo: 'attempted', attempted: 'solved', solved: 'todo' };

const compact = (n) => {
  if (!n) return '—';
  if (n >= 1000000) return `${Math.round(n / 100000) / 10}M`;
  if (n >= 1000) return `${Math.round(n / 100) / 10}k`;
  return String(n);
};

const shortDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
};

const relativeDays = (value) => {
  if (!value) return '—';
  const days = Math.round((new Date(value) - Date.now()) / 86400000);
  if (days === 0) return 'today';
  if (days > 0) return `in ${days}d`;
  return `${-days}d ago`;
};

/** Short forms, because a table cell is not the place for "Educational round". */
const DIVISION_SHORT = {
  'Div. 1': 'D1',
  'Div. 2': 'D2',
  'Div. 3': 'D3',
  'Div. 4': 'D4',
  'Div. 1 + 2': 'D1+2',
  Educational: 'EDU',
  Global: 'GLOB',
  Other: '—',
  'Div 1': 'D1',
  'Div 2': 'D2',
  'Div 3': 'D3',
  'Div 4': 'D4',
};

const divisionOf = (p) => p.codeforces?.division || p.codechef?.division || '';
const ratingOf = (p) => (p.platform === 'codeforces' ? p.codeforces?.rating || 0 : 0);

export const CP_COLUMNS = [
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
    id: 'rating',
    label: 'Rating',
    width: 64,
    /*
      The one number the whole module is organised by, and the first thing
      anybody looks at — so it is visible by default and sits immediately left
      of the title. It carries the Codeforces rating colour, which most readers
      parse faster than the digits.
    */
    className: 'cell-mono',
    cell: ({ problem }) => {
      const rating = ratingOf(problem);
      if (!rating) {
        const cc = problem.codechef?.difficultyRating;
        // CodeChef's scale, marked as CodeChef's — never coloured with the
        // Codeforces ramp, which would claim an equivalence that does not hold.
        return cc ? <span className="cc-rating" title="CodeChef difficulty">{cc}</span> : <Empty />;
      }
      return (
        <span className="cf-rating" data-band={ratingKey(rating)}>
          {rating}
        </span>
      );
    },
  },
  {
    id: 'title',
    label: 'Problem',
    width: 320,
    required: true,
    grow: true,
    cell: ({ problem }) => (
      <div className="title-cell">
        <a
          className="title-link"
          href={problem.url || problem.editorialUrl || '#'}
          target="_blank"
          rel="noreferrer"
          title={problem.title}
        >
          {problem.title}
        </a>
        <span className="ext">
          <IconExternal size={11} />
        </span>
        {/* The judge's own coordinates, which is how a CP problem is actually
            named in conversation — "1352G", not its title. */}
        {problem.codeforces && (
          <span className="cf-id mono">
            {problem.codeforces.contestId}
            {problem.codeforces.index}
          </span>
        )}
        {problem.codechef && <span className="cf-id mono">{problem.codechef.code}</span>}
        {problem.mine && <span className="tag-mini">MINE</span>}
        {/*
          Accepted on the judge but not marked here. Not an error state — it is
          almost always a contest solve from before this ladder existed — so it
          reads as a prompt rather than a warning.
        */}
        {problem.progress?.solvedOnPlatform && problem.progress?.status !== 'solved' && (
          <span className="tag-mini ac" title="Codeforces has an accepted submission from you">
            AC
          </span>
        )}
      </div>
    ),
  },
  {
    id: 'platform',
    label: 'Judge',
    width: 84,
    cell: ({ problem }) => (
      <span className={`judge ${problem.platform}`}>
        {{ codeforces: 'Codeforces', codechef: 'CodeChef', custom: 'Mine' }[problem.platform]}
      </span>
    ),
  },
  {
    id: 'division',
    label: 'Div',
    width: 58,
    className: 'cell-mono cell-dim',
    cell: ({ problem }) => {
      const division = divisionOf(problem);
      if (!division) return <Empty />;
      return (
        <span className="div-tag" title={division}>
          {DIVISION_SHORT[division] || division}
        </span>
      );
    },
  },
  {
    id: 'letter',
    label: 'Slot',
    width: 48,
    className: 'cell-mono cell-dim',
    // "Div. 2 C" is a vocabulary, and the letter is half of it.
    cell: ({ problem }) => problem.codeforces?.index || <Empty />,
  },
  {
    id: 'tier',
    label: 'Tier',
    width: 118,
    hidden: true,
    className: 'cell-dim',
    cell: ({ problem, tierLabel }) => tierLabel(problem.tier) || <Empty />,
  },
  {
    id: 'pattern',
    label: 'Pattern',
    width: 170,
    hidden: true,
    className: 'cell-dim cell-truncate',
    cell: ({ problem, patternName }) => patternName(problem.patternSlug) || problem.patternSlug,
  },
  {
    id: 'topics',
    label: 'Topics',
    width: 180,
    cell: ({ problem, width }) => {
      if (!problem.topicTags?.length) return <Empty />;
      const { shown, hidden } = fitChips(problem.topicTags, width);
      return (
        <div className="chip-row" title={problem.topicTags.join(', ')}>
          {shown.map((t) => (
            <span className="topic-chip" key={t}>
              {t}
            </span>
          ))}
          {hidden > 0 && <span className="att-chip-more">+{hidden}</span>}
        </div>
      );
    },
  },
  {
    id: 'platformTags',
    label: 'Judge tags',
    width: 200,
    /*
      Hidden by default, and that is the whole point of it being its own column.
      A Codeforces tag list is the editorial's answer key — `dp, bitmasks` on a
      problem you have not started is most of the solution — so seeing them has
      to be something you turn on rather than something that happens to you.
    */
    hidden: true,
    cell: ({ problem, width }) => {
      if (!problem.platformTags?.length) return <Empty />;
      const { shown, hidden } = fitChips(problem.platformTags, width);
      return (
        <div className="chip-row spoiler" title="Judge tags — these give the approach away">
          {shown.map((t) => (
            <span className="topic-chip tag-spoiler" key={t}>
              {t}
            </span>
          ))}
          {hidden > 0 && <span className="att-chip-more">+{hidden}</span>}
        </div>
      );
    },
  },
  {
    id: 'contest',
    label: 'Contest',
    width: 210,
    hidden: true,
    className: 'cell-dim cell-truncate',
    cell: ({ problem }) => {
      const name = problem.codeforces?.contestName || problem.codechef?.contestCode || '';
      if (!name) return <Empty />;
      const id = problem.codeforces?.contestId;
      return id ? (
        <a
          className="cell-link contest-link"
          href={`https://codeforces.com/contest/${id}`}
          target="_blank"
          rel="noreferrer"
          title={name}
        >
          {name}
        </a>
      ) : (
        <span title={name}>{name}</span>
      );
    },
  },
  {
    id: 'contestDate',
    label: 'Held',
    width: 82,
    hidden: true,
    className: 'cell-mono cell-dim',
    cell: ({ problem }) => {
      const at = problem.codeforces?.contestStartedAt;
      return at ? new Date(at).getFullYear() : <Empty />;
    },
  },
  {
    id: 'solvedCount',
    label: 'Solvers',
    width: 74,
    hidden: true,
    className: 'cell-mono cell-dim',
    /*
      How many accounts have solved it. The best quality signal either judge
      publishes, and the one the curation floor is built on — a problem almost
      nobody solves is usually one almost nobody could parse.
    */
    cell: ({ problem }) =>
      compact(problem.codeforces?.solvedCount || problem.codechef?.successfulSubmissions),
  },
  {
    id: 'curated',
    label: 'From',
    width: 130,
    hidden: true,
    cell: ({ problem }) =>
      problem.sheets?.length ? (
        <div className="chip-row" title={problem.curationNote || problem.sheets.join(', ')}>
          {problem.sheets.map((s) => (
            <span className="tag-mini" key={s}>
              {{ 'cp-31': 'CP31', 'cf-ladders': 'LADDER', a2oj: 'A2OJ', 'cc-practice': 'CC' }[s] || s}
            </span>
          ))}
        </div>
      ) : (
        <Empty />
      ),
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
    id: 'attemptLog',
    label: 'Attempts',
    width: 186,
    /*
      A chip per sitting, newest last — read as a shape rather than a number.
      Three attempts ending in green is a different problem from three ending in
      red, and a count cannot tell them apart. Visible by default, like the
      roadmap's, because it is the reason the log is worth keeping.
    */
    cell: ({ progress, problem, width }) => {
      const attempts = progress.recentAttempts || [];
      if (!attempts.length) return <Empty />;
      const max = Math.max(1, Math.floor((width - 30) / 46));
      const shown = attempts.slice(-max);
      const hidden = (progress.attemptCount || attempts.length) - shown.length;

      return (
        <div
          className="att-cell"
          title={`${problem.title}\n\n${attempts.map(attemptTitle).join('\n\n')}`}
        >
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
    id: 'platformSolvedAt',
    label: 'AC on judge',
    width: 96,
    hidden: true,
    className: 'cell-mono cell-dim',
    // When the judge accepted it, which is often years before you tracked it.
    cell: ({ progress }) => shortDate(progress.platformSolvedAt),
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
    id: 'editorial',
    label: 'Editorial',
    width: 74,
    hidden: true,
    cell: ({ problem }) =>
      problem.editorialUrl ? (
        <a
          className="cell-link"
          href={problem.editorialUrl}
          target="_blank"
          rel="noreferrer"
          title="Official editorial"
        >
          <IconExternal size={12} />
        </a>
      ) : (
        <Empty />
      ),
  },
  {
    id: 'solutions',
    label: 'Solution',
    width: 88,
    hidden: true,
    /*
      A link, never inline code. It belongs to whoever wrote it and lives under
      their licence — and a solution that appears on the row is a solution
      someone reads by accident.
    */
    cell: ({ problem }) =>
      problem.solutions?.length ? (
        <span className="soln-row">
          {problem.solutions.map((s) => (
            <a
              key={`${s.lang}-${s.url}`}
              className="soln-link"
              href={s.url}
              target="_blank"
              rel="noreferrer"
              title={`Reference solution (${s.lang}) — ${s.source}`}
            >
              <IconCode size={11} />
              {s.lang === 'cpp' ? 'C++' : s.lang === 'java' ? 'Java' : s.lang}
            </a>
          ))}
        </span>
      ) : (
        <Empty />
      ),
  },
  {
    id: 'video',
    label: 'Video',
    width: 62,
    hidden: true,
    cell: ({ problem }) =>
      problem.videoId ? (
        <a
          className="cell-link"
          href={`https://www.youtube.com/watch?v=${problem.videoId}`}
          target="_blank"
          rel="noreferrer"
          title="Watch the walkthrough"
        >
          <IconPlay size={12} />
        </a>
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
    // Why the problem made the ladder at all — popularity plus sheet weight.
    cell: ({ problem }) => (problem.score ? problem.score.toFixed(1) : <Empty />),
  },
  {
    id: 'actions',
    label: 'Track',
    width: 128,
    fixed: true,
    className: 'col-acts',
    cell: ({ actions }) => actions,
  },
];

export const CP_COLUMN_BY_ID = Object.fromEntries(CP_COLUMNS.map((c) => [c.id, c]));

/** The ladder freezes the rating alongside the title — it is how a row is read. */
export const CP_DEFAULT_PINNED = ['status', 'rating', 'title'];

export const CP_COLUMNS_STORAGE_KEY = 'cp-table-columns';
