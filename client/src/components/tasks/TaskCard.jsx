import { useRef, useState } from 'react';
import { IconCheckSquare, IconCode, IconMore, IconPaperclip } from '../ui/Icons.jsx';
import { ProgressRing } from './ProgressRing.jsx';
import { TaskMenu } from './TaskMenu.jsx';
import { TimerButton } from './TimerButton.jsx';
import { deadlineLabel, isDueSoon, isOverdue } from './time.js';

/**
 * One card on the board.
 *
 * The screenshot's anatomy, adapted: title, a line of notes, then a footer of
 * facts. What differs is what the facts are — there are no assignees on a board
 * with one reader, so the space they would take goes to the two things that do
 * matter here, the questions attached and the time spent.
 *
 * The whole card opens the drawer. Everything inside it that does something
 * else stops the click, which is why the timer and the menu each do so
 * themselves rather than relying on the card to work out what was hit.
 */
export function TaskCard({
  task,
  statuses,
  status,
  progress,
  solved,
  dragging,
  dragProps,
  onOpen,
  onMove,
  onDelete,
  onChange,
}) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);

  const overdue = isOverdue(task);
  const soon = isDueSoon(task);
  const done = status?.kind === 'done';

  const questions = task.questions || [];
  const questionsDone = questions.filter((q) => solved.has(String(q.problemId))).length;
  const subtasks = task.subtasks || [];
  const subtasksDone = subtasks.filter((s) => s.done).length;

  return (
    <article
      className={`tk-card ${dragging ? 'is-dragging' : ''} ${done ? 'is-done' : ''}`}
      data-priority={task.priority !== 'none' ? task.priority : undefined}
      {...dragProps}
      onClick={onOpen}
      /*
        Enter opens; `[` and `]` move the card a column left or right.

        The third way to move a card, after the drag and the menu, and the only
        one a keyboard can reach in one keystroke. Scoped to the focused card
        rather than registered on the page, so it cannot fire behind a dialog
        and there is nothing for `isAnyModalOpen` to suppress.
      */
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
          return;
        }
        if (event.key !== '[' && event.key !== ']') return;
        const here = statuses.findIndex((entry) => String(entry.id) === String(task.status));
        const next = statuses[here + (event.key === ']' ? 1 : -1)];
        if (!next) return;
        event.preventDefault();
        onMove(next.id);
      }}
      role="button"
      tabIndex={0}
      aria-label={task.title}
    >
      <h3 className="tk-card-title">{task.title}</h3>
      {task.notes && <p className="tk-card-notes">{task.notes}</p>}

      {task.tags?.length > 0 && (
        <div className="tk-card-tags">
          {task.tags.map((tag) => (
            <span key={tag} className="tag-mini">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="tk-card-meta">
        {task.dueAt && (
          <span className={`tk-due ${overdue ? 'overdue' : ''} ${soon ? 'soon' : ''}`}>
            {deadlineLabel(task.dueAt)}
          </span>
        )}
        <span className="spacer" />
        <ProgressRing {...progress} />
      </div>

      <div className="tk-card-foot">
        <TimerButton task={task} onChange={onChange} />

        <span className="spacer" />

        {questions.length > 0 && (
          <span
            className="tk-count"
            title={`${questionsDone} of ${questions.length} questions solved`}
          >
            {/* An icon rather than a boxed "Q": at 10px the box reads as a
                zero sitting in front of the count. */}
            <IconCode size={11} />
            {questionsDone}/{questions.length}
          </span>
        )}
        {subtasks.length > 0 && (
          <span className="tk-count" title={`${subtasksDone} of ${subtasks.length} subtasks done`}>
            <IconCheckSquare size={11} />
            {subtasksDone}/{subtasks.length}
          </span>
        )}
        {task.attachments?.length > 0 && (
          <span className="tk-count" title={`${task.attachments.length} attached`}>
            <IconPaperclip size={11} />
            {task.attachments.length}
          </span>
        )}

        <span className="tk-card-menu">
          <button
            ref={menuRef}
            type="button"
            className="icon-btn"
            aria-label={`Actions for ${task.title}`}
            aria-expanded={menu}
            onClick={(event) => {
              event.stopPropagation();
              setMenu((open) => !open);
            }}
          >
            <IconMore size={13} />
          </button>
          {menu && (
            <TaskMenu
              anchorRef={menuRef}
              task={task}
              statuses={statuses}
              onMove={onMove}
              onOpen={onOpen}
              onDelete={onDelete}
              onClose={() => setMenu(false)}
            />
          )}
        </span>
      </div>
    </article>
  );
}
