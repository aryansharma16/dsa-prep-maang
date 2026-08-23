import { useMemo, useState } from 'react';
import { IconChevronsDown, IconChevronsUp } from '../ui/Icons.jsx';
import { ProgressRing } from './ProgressRing.jsx';
import { deadlineLabel, duration, isDueSoon, isOverdue } from './time.js';

/**
 * Every task at once, sortable.
 *
 * A fixed set of columns rather than `useTableLayout`. That hook is bound to
 * the roadmap's 22-column registry and its saved layout; bending it around six
 * task columns would couple two screens that have no reason to move together,
 * and the thing it buys — show/hide, resize, pin — is worth having on 22
 * columns and not on six.
 *
 * This is the view for a question the board cannot answer: what is oldest, what
 * has taken longest, what is due first across every column at once.
 */

const COLUMNS = [
  { id: 'title', label: 'Task', sort: (task) => task.title.toLowerCase() },
  { id: 'status', label: 'Column', sort: (task, { statusName }) => statusName(task).toLowerCase() },
  { id: 'priority', label: 'Priority', sort: (task) => ['none', 'low', 'med', 'high'].indexOf(task.priority) },
  {
    id: 'due',
    label: 'Deadline',
    // No deadline sorts last ascending, which is the only order that puts the
    // dated ones — the whole reason to sort by this — at the top.
    sort: (task) => (task.dueAt ? new Date(task.dueAt).getTime() : Number.MAX_SAFE_INTEGER),
  },
  { id: 'progress', label: 'Done', sort: (task, { progress }) => progress(task).percent },
  { id: 'time', label: 'Time', sort: (task) => task.trackedSeconds || 0 },
  { id: 'created', label: 'Added', sort: (task) => new Date(task.createdAt).getTime() },
];

export function TableView({ statuses, tasks, progressOf, onOpen }) {
  const [sort, setSort] = useState({ id: 'created', dir: -1 });

  const statusOf = useMemo(() => {
    const index = new Map(statuses.map((status) => [String(status.id), status]));
    return (task) => index.get(String(task.status));
  }, [statuses]);

  const helpers = useMemo(
    () => ({
      statusName: (task) => statusOf(task)?.name || '',
      progress: (task) => progressOf(task, statusOf(task)),
    }),
    [statusOf, progressOf],
  );

  const rows = useMemo(() => {
    const column = COLUMNS.find((entry) => entry.id === sort.id) || COLUMNS[0];
    return [...tasks].sort((a, b) => {
      const left = column.sort(a, helpers);
      const right = column.sort(b, helpers);
      if (left < right) return -sort.dir;
      if (left > right) return sort.dir;
      return 0;
    });
  }, [tasks, sort, helpers]);

  const click = (id) =>
    setSort((prev) => (prev.id === id ? { id, dir: -prev.dir } : { id, dir: 1 }));

  return (
    <div className="tk-table-wrap">
      <table className="tk-table">
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column.id} aria-sort={sort.id === column.id ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                <button type="button" onClick={() => click(column.id)}>
                  {column.label}
                  {sort.id === column.id &&
                    (sort.dir === 1 ? <IconChevronsUp size={11} /> : <IconChevronsDown size={11} />)}
                </button>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((task) => {
            const status = statusOf(task);
            return (
              <tr key={task.id} onClick={() => onOpen(task)} tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') onOpen(task); }}>
                <td className="tk-td-title">{task.title}</td>
                <td>
                  <span className="tk-td-status" data-hue={status?.hue}>
                    <i className="tk-dot" aria-hidden="true" />
                    {status?.name}
                  </span>
                </td>
                <td>
                  {task.priority !== 'none' && (
                    <span className={`tk-pri ${task.priority}`}>{task.priority}</span>
                  )}
                </td>
                <td>
                  {task.dueAt && (
                    <span
                      className={`tk-due ${isOverdue(task) ? 'overdue' : ''} ${
                        isDueSoon(task) ? 'soon' : ''
                      }`}
                    >
                      {deadlineLabel(task.dueAt)}
                    </span>
                  )}
                </td>
                <td>
                  <ProgressRing {...progressOf(task, status)} />
                </td>
                <td className="mono">{duration(task.trackedSeconds)}</td>
                <td className="mono tk-td-dim">
                  {new Date(task.createdAt).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                  })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
