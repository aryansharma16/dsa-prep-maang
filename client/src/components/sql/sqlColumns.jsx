import { IconCheck, IconExternal } from '../ui/Icons.jsx';

/**
 * What a row in the bank can show.
 *
 * The same registry shape the roadmap and the ladder use, so `useTableLayout`,
 * `ColumnsModal` and `cellProps` all work unchanged: `{ id, label, width, cell }`
 * plus the optional `head`, `fixed`, `required`, `grow`, `hidden` and
 * `className`.
 *
 * Two ids are load-bearing and cannot be renamed: `actions` is matched by name
 * in `useTableLayout` for right-pinning, and every id here is a localStorage
 * key in the saved layout.
 *
 * ---------------------------------------------------------------------------
 * One column behaves differently per row, and it is the title.
 *
 * A `mode: 'editor'` problem opens the workbench, so its title is a button. A
 * `mode: 'external'` one lives on a judge, so its title is an anchor with the
 * external-link mark beside it — the same `title-cell` / `title-link` / `ext`
 * markup the roadmap and the ladder use, because it is the same act and it
 * should not look like a different one.
 *
 * The distinction is deliberately visible *before* the click rather than after
 * it. A row that silently opened a new tab when the one above it opened a panel
 * would be the kind of surprise that makes people stop trusting a table.
 * ---------------------------------------------------------------------------
 */

const Empty = () => <span className="cell-empty">—</span>;

/**
 * How a platform is written on a row.
 *
 * A map rather than the raw slug, because "leetcode" in a 96px column reads
 * worse than "LC" and the two need to agree wherever both appear. Anything not
 * listed falls back to its own slug, so adding a second judge is a data change
 * rather than a code change.
 */
const PLATFORM_LABEL = {
  leetcode: 'LC',
  github: 'repo',
};

/** The hover text on a linked row: what it asks, then where it goes. */
const externalTip = (problem) => {
  const summary = (problem.statement || '').split('\n\n')[0].replace(/[`*]/g, '');
  const where = `Opens on ${problem.source?.platform || 'the platform'}`;
  return summary ? `${summary}\n\n${where}` : where;
};

const STATUS_LABEL = {
  todo: 'Not started',
  attempted: 'Attempted — click to mark solved by hand',
  solved: 'Solved',
};
const NEXT_STATUS = { todo: 'attempted', attempted: 'solved', solved: 'todo' };

export const SQL_COLUMNS = [
  {
    id: 'status',
    label: 'Done',
    head: '',
    width: 40,
    fixed: true,
    className: 'col-status',
    cell: ({ status, setProgress, problem }) => (
      <button
        type="button"
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
    id: 'difficulty',
    label: 'Level',
    width: 76,
    fixed: true,
    cell: ({ problem }) => (
      <span className={`sql-diff-tag diff-${problem.difficulty.toLowerCase()}`}>
        {problem.difficulty}
      </span>
    ),
  },

  {
    id: 'title',
    label: 'Problem',
    width: 340,
    required: true,
    grow: true,
    cell: ({ problem, onOpen }) =>
      problem.mode === 'external' ? (
        <div className="title-cell sql-title-ext">
          <a
            className="title-link"
            href={problem.source?.url}
            target="_blank"
            rel="noreferrer"
            /*
              The summary, not the title — the title is already the link text.
              A linked row has nowhere else to show what the question actually
              asks, since there is no workbench to open, so the one line written
              for it lives here rather than being carried around unread.
            */
            title={externalTip(problem)}
          >
            {problem.title}
          </a>
          <span className="ext">
            <IconExternal size={11} />
          </span>
          {problem.source?.platform && (
            <span className="tag-mini">{PLATFORM_LABEL[problem.source.platform] || problem.source.platform}</span>
          )}
        </div>
      ) : (
        <button type="button" className="sql-title-cell" onClick={() => onOpen(problem)}>
          {problem.title}
          {problem.mine && <span className="tag-mini">mine</span>}
        </button>
      ),
  },

  {
    id: 'category',
    label: 'Category',
    width: 132,
    hidden: true,
    cell: ({ problem, categoryLabel }) => (
      <span className="sql-cat-tag mono" data-category={problem.category}>
        {categoryLabel(problem.category)}
      </span>
    ),
  },

  {
    id: 'topics',
    label: 'Topics',
    width: 190,
    cell: ({ problem }) =>
      problem.topicTags?.length ? (
        <div className="chip-row" title={problem.topicTags.join(', ')}>
          {problem.topicTags.slice(0, 3).map((t) => (
            <span className="topic-chip" key={t}>
              {t}
            </span>
          ))}
          {problem.topicTags.length > 3 && (
            <span className="att-chip-more">+{problem.topicTags.length - 3}</span>
          )}
        </div>
      ) : (
        <Empty />
      ),
  },

  {
    id: 'attempts',
    label: 'Runs',
    width: 64,
    className: 'cell-mono cell-dim',
    cell: ({ progress }) => progress.attemptCount || <Empty />,
  },

  {
    id: 'timeSpent',
    label: 'Time',
    width: 64,
    hidden: true,
    className: 'cell-mono cell-dim',
    cell: ({ progress }) =>
      progress.attemptMinutes ? `${progress.attemptMinutes}m` : <Empty />,
  },

  {
    id: 'nextReview',
    label: 'Due',
    width: 92,
    hidden: true,
    className: 'cell-mono cell-dim',
    cell: ({ progress }) => {
      if (!progress.nextReviewAt) return <Empty />;
      const days = Math.round((new Date(progress.nextReviewAt) - Date.now()) / 86400000);
      if (days < 0) return <span className="due-now">due</span>;
      return days === 0 ? 'today' : `${days}d`;
    },
  },

  {
    id: 'where',
    label: 'Where',
    width: 96,
    cell: ({ problem }) =>
      problem.mode === 'external' ? (
        <span className="sql-where-tag is-external" title="Opens on the platform — solved and judged there">
          {PLATFORM_LABEL[problem.source?.platform] || problem.source?.platform || 'platform'}
        </span>
      ) : (
        <span className="sql-where-tag" title="Runs in your browser — the Lab marks it">
          Lab
        </span>
      ),
  },

  {
    id: 'source',
    label: 'From',
    width: 110,
    hidden: true,
    cell: ({ problem }) =>
      problem.source?.url ? (
        <a className="cell-link" href={problem.source.url} target="_blank" rel="noreferrer">
          {problem.source.plan === 'top-sql-50' && problem.source.planOrder
            ? `SQL 50 #${problem.source.planOrder}`
            : problem.source.platform || 'source'}
        </a>
      ) : (
        <Empty />
      ),
  },

  {
    id: 'actions',
    label: 'Track',
    width: 96,
    fixed: true,
    className: 'col-acts',
    cell: ({ actions }) => actions,
  },
];

export const SQL_COLUMN_BY_ID = Object.fromEntries(SQL_COLUMNS.map((c) => [c.id, c]));

/**
 * Frozen alongside the title, because they are how a row is read: whether you
 * have done it, and how hard it is. Three is the maximum `useTableLayout`
 * allows, and `actions` must not be here — it is pinned right by name.
 */
export const SQL_DEFAULT_PINNED = ['status', 'difficulty', 'title'];

export const SQL_COLUMNS_STORAGE_KEY = 'sql-table-columns';
