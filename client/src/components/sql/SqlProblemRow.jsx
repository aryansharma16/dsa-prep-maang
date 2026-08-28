import { memo } from 'react';
import { useSql } from '../../store/SqlContext.jsx';
import { cellProps } from '../problem/cellProps.js';
import { IconFlag, IconRotate } from '../ui/Icons.jsx';

/**
 * One problem, as a table row.
 *
 * A twin of `ProblemRow` and `CPProblemRow` rather than a shared component, by
 * the argument the CP one records: the three collections have different fields
 * and different actions, and a component general enough for all three would be
 * a prop bag with a switch in it. What *is* shared is everything that matters —
 * the column registry shape, `cellProps`, and the status button's behaviour.
 *
 * The whole contract with `sqlColumns.jsx` is the single context object built
 * once per row and handed to every column's `cell`.
 */
export const SqlProblemRow = memo(function SqlProblemRow({
  problem,
  index,
  columns,
  onOpen,
  categoryLabel,
}) {
  const { setProgress } = useSql();

  const progress = problem.progress || {};
  const status = progress.status || 'todo';

  const actions = (
    <span className="acts">
      <button
        type="button"
        className={`act ${progress.flagged ? 'on' : ''}`}
        title={progress.flagged ? 'Unflag' : 'Flag'}
        aria-label={progress.flagged ? 'Unflag' : 'Flag'}
        onClick={() => setProgress(problem._id, { flagged: !progress.flagged })}
      >
        <IconFlag size={12} />
      </button>
      <button
        type="button"
        className={`act ${progress.needsRevision ? 'on' : ''}`}
        title={progress.needsRevision ? 'Not for revision' : 'Mark for revision'}
        aria-label={progress.needsRevision ? 'Not for revision' : 'Mark for revision'}
        onClick={() => setProgress(problem._id, { needsRevision: !progress.needsRevision })}
      >
        <IconRotate size={12} />
      </button>
    </span>
  );

  const rowClass = [status === 'solved' && 'solved', progress.flagged && 'flagged']
    .filter(Boolean)
    .join(' ');

  return (
    <tr data-row={problem._id} className={rowClass}>
      {columns.map((column) => (
        <td key={column.id} {...cellProps(column)}>
          {column.cell({
            problem,
            index,
            progress,
            status,
            width: column.px,
            setProgress,
            onOpen,
            categoryLabel,
            actions,
          })}
        </td>
      ))}
    </tr>
  );
});
