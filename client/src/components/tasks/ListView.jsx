import { useState } from 'react';
import { IconCheck, IconChevronRight, IconPaperclip, IconPlus } from '../ui/Icons.jsx';
import { ProgressRing } from './ProgressRing.jsx';
import { TimerButton } from './TimerButton.jsx';
import { deadlineLabel, isDueSoon, isOverdue } from './time.js';

/**
 * The board as rows, grouped under its columns.
 *
 * This is also what the board becomes on a phone. Four columns do not fit in
 * 360px and pretending otherwise produces a horizontal scroll with one column
 * visible at a time — which is a worse list than a list.
 *
 * Subtasks nest here rather than being counted, because a row has the width for
 * them and this is the view for working through a task rather than for seeing
 * the shape of the week.
 */
export function ListView({
  statuses,
  byStatus,
  solved,
  progressOf,
  onOpen,
  onAdd,
  onSubtaskToggle,
  onChange,
}) {
  const [collapsed, setCollapsed] = useState(() => new Set());

  const toggle = (id) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="tk-list">
      {statuses.map((status) => {
        const tasks = byStatus.get(String(status.id)) || [];
        const shut = collapsed.has(String(status.id));

        return (
          <section key={status.id} className="tk-list-group" data-hue={status.hue}>
            <header className="tk-list-head">
              <button
                type="button"
                className={`tk-list-toggle ${shut ? '' : 'open'}`}
                onClick={() => toggle(String(status.id))}
                aria-expanded={!shut}
              >
                <IconChevronRight size={12} />
                <i className="tk-dot" aria-hidden="true" />
                {status.name}
                <span className="tk-col-count mono">{tasks.length}</span>
              </button>
              <span className="spacer" />
              <button
                type="button"
                className="link-btn"
                onClick={() => onAdd('New task', status.id)}
              >
                <IconPlus size={11} />
                Add
              </button>
            </header>

            {!shut &&
              (tasks.length === 0 ? (
                <p className="hint dim tk-list-empty">Nothing here.</p>
              ) : (
                <ul className="tk-rows">
                  {tasks.map((task) => (
                    <li key={task.id}>
                      <div
                        className="tk-row"
                        role="button"
                        tabIndex={0}
                        onClick={() => onOpen(task)}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter' && event.key !== ' ') return;
                          event.preventDefault();
                          onOpen(task);
                        }}
                      >
                        <span className="tk-row-title">{task.title}</span>

                        {task.tags?.map((tag) => (
                          <span key={tag} className="tag-mini">
                            {tag}
                          </span>
                        ))}

                        <span className="spacer" />

                        {task.attachments?.length > 0 && (
                          <span className="tk-count">
                            <IconPaperclip size={11} />
                            {task.attachments.length}
                          </span>
                        )}
                        {task.dueAt && (
                          <span
                            className={`tk-due ${isOverdue(task) ? 'overdue' : ''} ${
                              isDueSoon(task) ? 'soon' : ''
                            }`}
                          >
                            {deadlineLabel(task.dueAt)}
                          </span>
                        )}
                        <TimerButton task={task} onChange={onChange} />
                        <ProgressRing {...progressOf(task, status)} />
                      </div>

                      {task.subtasks?.length > 0 && (
                        <ul className="tk-row-subs">
                          {task.subtasks.map((subtask) => (
                            <li key={subtask.id} className={subtask.done ? 'done' : ''}>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={subtask.done}
                                  onChange={() => onSubtaskToggle(task, subtask, !subtask.done)}
                                />
                                <span>{subtask.title}</span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      )}

                      {task.questions?.length > 0 && (
                        <ul className="tk-row-subs questions">
                          {task.questions.map((question) => {
                            const done = solved.has(String(question.problemId));
                            return (
                              <li key={question.problemId} className={done ? 'done' : ''}>
                                <span className="tk-q-tick" aria-hidden="true">
                                  {done && <IconCheck size={10} />}
                                </span>
                                <span className={`diff ${question.difficulty}`}>
                                  {question.difficulty?.[0] || '?'}
                                </span>
                                <span>{question.title}</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              ))}
          </section>
        );
      })}
    </div>
  );
}
