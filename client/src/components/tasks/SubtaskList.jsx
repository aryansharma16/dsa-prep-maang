import { useState } from 'react';
import { IconPlus, IconTrash } from '../ui/Icons.jsx';

/**
 * The checklist. One level, which is what the schema allows and what the thing
 * it is for needs — "do these three questions" is a list, not a tree.
 *
 * Ticking is optimistic. The round trip is short but it is not instant, and a
 * checkbox that waits for the network before it moves feels broken in a way
 * that a checkbox which occasionally springs back does not.
 */
export function SubtaskList({ subtasks, onAdd, onToggle, onRemove }) {
  const [title, setTitle] = useState('');
  const [pending, setPending] = useState({});

  const submit = (event) => {
    event.preventDefault();
    const value = title.trim();
    if (!value) return;
    onAdd(value);
    setTitle('');
  };

  const toggle = (subtask) => {
    const next = !(pending[subtask.id] ?? subtask.done);
    setPending((prev) => ({ ...prev, [subtask.id]: next }));
    Promise.resolve(onToggle(subtask, next)).catch(() =>
      setPending((prev) => ({ ...prev, [subtask.id]: !next })),
    );
  };

  const done = subtasks.filter((s) => pending[s.id] ?? s.done).length;

  return (
    <div className="tk-subtasks">
      {subtasks.length > 0 && (
        <div className="tk-section-count mono">
          {done}/{subtasks.length}
        </div>
      )}

      <ul>
        {subtasks.map((subtask) => {
          const checked = pending[subtask.id] ?? subtask.done;
          return (
            <li key={subtask.id} className={checked ? 'done' : ''}>
              <label>
                <input type="checkbox" checked={checked} onChange={() => toggle(subtask)} />
                <span>{subtask.title}</span>
              </label>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove ${subtask.title}`}
                title="Remove"
                onClick={() => onRemove(subtask)}
              >
                <IconTrash size={11} />
              </button>
            </li>
          );
        })}
      </ul>

      <form className="tk-inline-add" onSubmit={submit}>
        <IconPlus size={12} />
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Add a step…"
          aria-label="Add a subtask"
          maxLength={200}
        />
      </form>
    </div>
  );
}
