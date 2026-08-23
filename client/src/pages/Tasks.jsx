import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorMessage } from '../api/http.js';
import { tasksApi } from '../api/index.js';
import { FiltersModal } from '../components/filters/FiltersModal.jsx';
import { BoardView } from '../components/tasks/BoardView.jsx';
import { CalendarView } from '../components/tasks/CalendarView.jsx';
import { DeleteStatusModal } from '../components/tasks/DeleteStatusModal.jsx';
import { ListView } from '../components/tasks/ListView.jsx';
import { solvedIndex, taskProgress } from '../components/tasks/progress.js';
import { StatusModal } from '../components/tasks/StatusModal.jsx';
import { TableView } from '../components/tasks/TableView.jsx';
import { TaskDrawer } from '../components/tasks/TaskDrawer.jsx';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx';
import {
  IconBoard,
  IconCalendar,
  IconFilter,
  IconList,
  IconPlus,
  IconSearch,
  IconTable,
} from '../components/ui/Icons.jsx';
import { TASK_FILTERS } from '../filters/tasks.js';
import { activeCount, clearPatch, matchesFilters } from '../filters/spec.js';
import { useLocalState } from '../hooks/useLocalState.js';
import { useMediaQuery, NARROW } from '../hooks/useMediaQuery.js';
import { useSavedFilters } from '../hooks/useSavedFilters.js';
import { useRoadmap } from '../store/RoadmapContext.jsx';
import { useTasks } from '../store/TasksContext.jsx';
import { useToast } from '../store/ToastContext.jsx';

/**
 * The board.
 *
 * One page, four views, one fetch. Everything is held in memory and filtered
 * locally — the same bargain the roadmap strikes, and for the same reason: the
 * collection is bounded (500 tasks), every view needs the whole set to group
 * and count, and a paged board cannot tell you how much is in the column below
 * the fold.
 *
 * Writes are optimistic where the answer is obvious and the cost of being wrong
 * is a card in the wrong place for a moment — moving, ticking, adding. They are
 * not optimistic where the server decides something the client cannot know,
 * which is anything touching a column's `kind`.
 */

const VIEWS = [
  { id: 'board', label: 'Board', Icon: IconBoard },
  { id: 'list', label: 'List', Icon: IconList },
  { id: 'table', label: 'Table', Icon: IconTable },
  { id: 'calendar', label: 'Calendar', Icon: IconCalendar },
];

export function Tasks() {
  const { groups } = useRoadmap();
  const { sync } = useTasks();
  const { success, error: toastError } = useToast();

  const [board, setBoard] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [view, setView] = useLocalState('tasks:view', 'board');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useSavedFilters('tasks', TASK_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [openId, setOpenId] = useState(null);
  const [editingStatus, setEditingStatus] = useState(null);
  const [deletingStatus, setDeletingStatus] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const narrow = useMediaQuery(NARROW);

  /* ---------------------------------------------------------------- loading */

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tasksApi.board();
      setBoard(data.board);
      setTasks(data.tasks);
      setLoadError('');
    } catch (err) {
      setLoadError(errorMessage(err, 'Could not load your board'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Replaces one task in place, and tells the top bar if its clock changed. */
  const put = useCallback(
    (task) => {
      if (!task) return;
      setTasks((prev) => prev.map((entry) => (entry.id === task.id ? task : entry)));
      sync(task);
    },
    [sync],
  );

  /**
   * Runs a write, replaces the task, and puts the board back if it fails.
   *
   * The rollback is the whole point: every optimistic edit below applies first
   * and calls this, so a failed save cannot leave the screen showing something
   * the server never accepted.
   */
  const commit = useCallback(
    async (run, { rollback, message } = {}) => {
      try {
        const task = await run();
        if (task) put(task);
        return task;
      } catch (err) {
        if (rollback) setTasks(rollback);
        toastError(errorMessage(err, message || 'That did not save'));
        return null;
      }
    },
    [put, toastError],
  );

  /* ---------------------------------------------------------------- derived */

  const statuses = board?.statuses || [];
  const statusById = useMemo(
    () => new Map(statuses.map((status) => [String(status.id), status])),
    [statuses],
  );

  const solved = useMemo(() => solvedIndex(groups), [groups]);

  const progressOf = useCallback(
    (task, status) => taskProgress(task, solved, status?.kind),
    [solved],
  );

  const tagOptions = useMemo(
    () => [...new Set(tasks.flatMap((task) => task.tags || []))].sort(),
    [tasks],
  );

  /**
   * Search is separate from the filters and deliberately not saved.
   *
   * A filter describes a view you want to come back to; a search is a thing you
   * are doing right now. Restoring one on load would mean opening the board to
   * three cards and no obvious reason why — the roadmap makes the same split.
   */
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (!matchesFilters(TASK_FILTERS, filters, task)) return false;
      if (!needle) return true;
      return [
        task.title,
        task.notes,
        ...(task.tags || []),
        ...(task.questions || []).map((question) => question.title),
        ...(task.subtasks || []).map((subtask) => subtask.title),
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [tasks, filters, query]);

  const byStatus = useMemo(() => {
    const map = new Map(statuses.map((status) => [String(status.id), []]));
    for (const task of visible) {
      const list = map.get(String(task.status));
      if (list) list.push(task);
    }
    for (const list of map.values()) list.sort((a, b) => a.order - b.order);
    return map;
  }, [visible, statuses]);

  const open = openId ? tasks.find((task) => task.id === openId) : null;
  // The drawer must close if its task disappears — deleted here or in another tab.
  useEffect(() => {
    if (openId && !loading && !open) setOpenId(null);
  }, [openId, open, loading]);

  const filterCount = activeCount(TASK_FILTERS, filters);
  const narrowing = activeCount(TASK_FILTERS, filters, 'dialog');
  const patch = (changes) => setFilters((prev) => ({ ...prev, ...changes }));

  /* ------------------------------------------------------------------ tasks */

  const addTask = async (title, statusId) => {
    try {
      const task = await tasksApi.create({ title, status: statusId });
      setTasks((prev) => [...prev, task]);
    } catch (err) {
      toastError(errorMessage(err, 'Could not add that task'));
    }
  };

  const moveTask = ({ id, status, ids }) => {
    const before = tasks;
    const rank = new Map(ids.map((taskId, index) => [taskId, index]));

    setTasks((prev) =>
      prev.map((task) => {
        if (!rank.has(task.id)) return task;
        return {
          ...task,
          order: rank.get(task.id),
          ...(task.id === id ? { status } : {}),
        };
      }),
    );

    return commit(() => tasksApi.move({ id, status, ids }), {
      rollback: before,
      message: 'Could not move that task',
    });
  };

  /** The `⋯` menu and the drawer's dropdown: a column change with no ordering. */
  const moveTaskTo = (task, statusId) => {
    const ids = (byStatus.get(String(statusId)) || []).map((entry) => entry.id);
    return moveTask({ id: task.id, status: statusId, ids: [...ids, task.id] });
  };

  const patchTask = (task, changes) =>
    commit(() => tasksApi.update(task.id, changes), { message: 'Could not save that change' });

  const deleteTask = (task) => setConfirmDelete(task);

  const reallyDelete = async () => {
    const task = confirmDelete;
    const before = tasks;
    setConfirmDelete(null);
    setOpenId((current) => (current === task.id ? null : current));
    setTasks((prev) => prev.filter((entry) => entry.id !== task.id));
    sync(null, task.id);

    try {
      await tasksApi.remove(task.id);
      success('Task deleted');
    } catch (err) {
      setTasks(before);
      toastError(errorMessage(err, 'Could not delete that task'));
    }
  };

  /* -------------------------------------------------------------- the parts */

  const toggleSubtask = (task, subtask, done) =>
    commit(() => tasksApi.updateSubtask(task.id, subtask.id, { done }));

  const scheduleTask = (task, date) => {
    const before = tasks;
    setTasks((prev) =>
      prev.map((entry) => (entry.id === task.id ? { ...entry, dueAt: date } : entry)),
    );
    return commit(() => tasksApi.update(task.id, { dueAt: date }), { rollback: before });
  };

  /* ---------------------------------------------------------------- columns */

  const saveStatus = async (changes) => {
    const data = editingStatus?.id
      ? await tasksApi.updateStatus(editingStatus.id, changes)
      : await tasksApi.addStatus(changes);
    setBoard(data.board);
    // A kind change completes or un-completes everything in the column, which
    // is a server-side effect on rows this page is holding.
    await load();
  };

  /** Optimistic: the columns are already redrawn, so a failure has to put them back. */
  const reorderColumns = async (ids) => {
    const before = board;
    const rank = new Map(ids.map((id, index) => [id, index]));
    setBoard((prev) => ({
      ...prev,
      statuses: [...prev.statuses].sort(
        (a, b) => rank.get(String(a.id)) - rank.get(String(b.id)),
      ),
    }));

    try {
      setBoard(await tasksApi.reorderStatuses(ids));
    } catch (err) {
      setBoard(before);
      toastError(errorMessage(err, 'Could not reorder the columns'));
    }
  };

  const askDeleteStatus = (status) => {
    const held = tasks.filter((task) => String(task.status) === String(status.id)).length;
    if (!held) {
      tasksApi
        .removeStatus(status.id)
        .then((data) => setBoard(data.board))
        .catch((err) => toastError(errorMessage(err, 'Could not delete that column')));
      return;
    }
    setDeletingStatus({ status, count: held });
  };

  const confirmDeleteStatus = async (moveTo) => {
    const data = await tasksApi.removeStatus(deletingStatus.status.id, moveTo);
    setBoard(data.board);
    await load();
  };

  /* ----------------------------------------------------------------- render */

  /*
    The board does not fit a phone — four columns in 360px is a horizontal
    scroll with one column visible, which is a worse list than a list. The
    stored preference is left alone so the choice comes back on a wide screen.
  */
  const effective = narrow && view === 'board' ? 'list' : view;

  const shared = {
    statuses,
    byStatus,
    solved,
    progressOf,
    onOpen: (task) => setOpenId(task.id),
    onAdd: addTask,
    onChange: put,
  };

  return (
    <div className="tk-page">
      <header className="tk-head">
        <div className="page-head">
          <h1>Tasks</h1>
          <p>What you meant to do today, and how long it actually took.</p>
        </div>
        <button
          type="button"
          className="btn primary"
          disabled={!statuses.length}
          onClick={() => addTask('New task', statuses[0]?.id)}
        >
          <IconPlus size={12} />
          New task
        </button>
      </header>

      <div className="tk-bar">
        <div className="tk-views" role="tablist" aria-label="View">
          {VIEWS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={effective === id}
              className={effective === id ? 'on' : ''}
              disabled={narrow && id === 'board'}
              title={narrow && id === 'board' ? 'The board needs a wider screen' : undefined}
              onClick={() => setView(id)}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        <label className="tk-search">
          <IconSearch size={13} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tasks…"
            aria-label="Search tasks"
          />
        </label>

        {TASK_FILTERS.fields
          .filter((field) => field.place === 'bar')
          .map((field) => (
            <button
              key={field.id}
              type="button"
              className={`toggle-chip ${filters[field.id] ? 'on' : ''}`}
              onClick={() => patch({ [field.id]: !filters[field.id] })}
            >
              {field.label}
            </button>
          ))}

        {/* The roadmap's filter chip, verbatim — same control, same count
            treatment, so the two screens are not subtly different. */}
        <button
          type="button"
          className={`toggle-chip ${narrowing ? 'on' : ''}`}
          onClick={() => setFiltersOpen(true)}
        >
          <IconFilter size={12} />
          Filters
          {narrowing > 0 && <span className="mono">{narrowing}</span>}
        </button>

        {filterCount > 0 && (
          <button type="button" className="link-btn" onClick={() => patch(clearPatch(TASK_FILTERS))}>
            Clear all
          </button>
        )}
      </div>

      {loadError && <div className="alert">{loadError}</div>}

      {loading ? (
        <div className="loading">Loading…</div>
      ) : !statuses.length ? (
        <div className="empty">
          <h3>This board has no columns</h3>
          <p>Add one to get started.</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="empty">
          <h3>Nothing on the board</h3>
          <p>
            Write down the next thing you mean to sit down and do — “finish sliding window”,
            “three graph questions” — then pull the problems into it.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty">
          <h3>Nothing matches</h3>
          <p>Try a different word, or clear the filters.</p>
        </div>
      ) : effective === 'board' ? (
        <BoardView
          {...shared}
          onMove={moveTask}
          onMoveTo={moveTaskTo}
          onDelete={deleteTask}
          onEditColumn={(status) => setEditingStatus(status)}
          onDeleteColumn={askDeleteStatus}
          onAddColumn={() => setEditingStatus({})}
          onReorderColumns={reorderColumns}
        />
      ) : effective === 'list' ? (
        <ListView {...shared} onSubtaskToggle={toggleSubtask} />
      ) : effective === 'table' ? (
        <TableView
          statuses={statuses}
          tasks={visible}
          progressOf={progressOf}
          onOpen={shared.onOpen}
        />
      ) : (
        <CalendarView
          statuses={statuses}
          tasks={visible}
          onOpen={shared.onOpen}
          onSchedule={scheduleTask}
        />
      )}

      {open && (
        <TaskDrawer
          task={open}
          statuses={statuses}
          solved={solved}
          onClose={() => setOpenId(null)}
          onChange={put}
          onPatch={(changes) => patchTask(open, changes)}
          onDelete={() => deleteTask(open)}
          onSubtaskAdd={(title) => commit(() => tasksApi.addSubtask(open.id, title))}
          onSubtaskToggle={(subtask, done) => toggleSubtask(open, subtask, done)}
          onSubtaskRemove={(subtask) => commit(() => tasksApi.removeSubtask(open.id, subtask.id))}
          onQuestionsAdd={(ids) => commit(() => tasksApi.addQuestions(open.id, ids))}
          onQuestionRemove={(problemId) =>
            commit(() => tasksApi.removeQuestion(open.id, problemId))
          }
          onUpload={async (files, onProgress) => {
            const result = await tasksApi.upload(open.id, files, onProgress);
            put(result.task);
            if (!result.failed?.length) return;
            /*
              The server reports per file, and the reasons differ — a rejected
              type, a bucket that is not configured on this deployment. Echoing
              its own message beats guessing: "images and PDFs only" is a
              confusing thing to be told when the real answer is that uploads
              are switched off here.
            */
            const [first] = result.failed;
            const extra = result.failed.length > 1 ? ` (and ${result.failed.length - 1} more)` : '';
            toastError(`Could not attach ${first.originalName}: ${first.error}${extra}`);
          }}
          onAttachmentRemove={(file) =>
            commit(() => tasksApi.removeAttachment(open.id, file.id))
          }
          onSessionAdd={(minutes) => commit(() => tasksApi.addSession(open.id, minutes))}
          onSessionRemove={(session) => commit(() => tasksApi.removeSession(open.id, session.id))}
        />
      )}

      {filtersOpen && (
        <FiltersModal
          spec={TASK_FILTERS}
          value={filters}
          options={{ tags: tagOptions }}
          shown={visible.length}
          total={tasks.length}
          onChange={patch}
          onClose={() => setFiltersOpen(false)}
          title="Filter tasks"
        />
      )}

      {editingStatus && (
        <StatusModal
          status={editingStatus.id ? editingStatus : null}
          hasDone={statuses.some((status) => status.kind === 'done')}
          onSave={saveStatus}
          onClose={() => setEditingStatus(null)}
        />
      )}

      {deletingStatus && (
        <DeleteStatusModal
          status={deletingStatus.status}
          count={deletingStatus.count}
          statuses={statuses}
          onConfirm={confirmDeleteStatus}
          onClose={() => setDeletingStatus(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this task?"
          message={`“${confirmDelete.title}” and everything on it — subtasks, attached questions, files and time.`}
          confirmLabel="Delete"
          tone="danger"
          onConfirm={reallyDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
