import { useEffect, useRef, useState } from 'react';
import { IconEdit, IconGrip, IconPlus, IconTrash } from '../ui/Icons.jsx';
import { TaskCard } from './TaskCard.jsx';

/**
 * One column: its header, its cards, and the box that adds another.
 *
 * `data-hue` sits on the column and nothing below it names a colour — the
 * header dot, the count, the card's edge and the progress ring all read `--hue`
 * from here. That is the whole reason the hue is a name and not a value: one
 * attribute recolours the column in both themes.
 */
export function StatusColumn({
  status,
  tasks,
  statuses,
  solved,
  progressOf,
  drag,
  onAdd,
  onOpen,
  onMove,
  onDelete,
  onChange,
  onEditColumn,
  onDeleteColumn,
  colDrag,
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const submit = (event) => {
    event.preventDefault();
    const value = title.trim();
    if (!value) {
      setAdding(false);
      return;
    }
    onAdd(value);
    // Stays open: adding tasks is something people do in a run of three or four,
    // and closing after each one would make the second cost two clicks.
    setTitle('');
  };

  return (
    <section
      className={`tk-col ${colDrag.dragging === String(status.id) ? 'col-dragging' : ''} ${
        colDrag.over === String(status.id) ? 'col-over' : ''
      }`}
      data-hue={status.hue}
      aria-label={status.name}
      {...drag.columnProps(status.id, tasks.length)}
      {...colDrag.dropProps(status.id)}
    >
      {/*
        The header is the drag handle, not the whole column — a column whose
        body was draggable would fight every card inside it for the gesture.
      */}
      <header className="tk-col-head" {...colDrag.handleProps(status.id)}>
        <span className="tk-col-grip" title="Drag to reorder columns">
          <IconGrip size={12} />
        </span>
        <i className="tk-dot" aria-hidden="true" />
        <h2>{status.name}</h2>
        <span className="tk-col-count mono">{tasks.length}</span>

        <span className="tk-col-tools">
          <button
            type="button"
            className="icon-btn"
            title="Edit this column"
            aria-label={`Edit the ${status.name} column`}
            onClick={() => onEditColumn(status)}
          >
            <IconEdit size={12} />
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Delete this column"
            aria-label={`Delete the ${status.name} column`}
            onClick={() => onDeleteColumn(status)}
          >
            <IconTrash size={12} />
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Add a task here"
            aria-label={`Add a task to ${status.name}`}
            onClick={() => setAdding(true)}
          >
            <IconPlus size={12} />
          </button>
        </span>
      </header>

      <div className="tk-col-body">
        {tasks.map((task, index) => (
          <div key={task.id} className="tk-slot">
            {drag.gapAt(status.id, index) && <div className="tk-gap" aria-hidden="true" />}
            <TaskCard
              task={task}
              status={status}
              statuses={statuses}
              solved={solved}
              progress={progressOf(task, status)}
              dragging={drag.dragging?.id === task.id}
              dragProps={drag.cardProps(task.id, index, status.id)}
              onOpen={() => onOpen(task)}
              onMove={(to) => onMove(task, to)}
              onDelete={() => onDelete(task)}
              onChange={onChange}
            />
          </div>
        ))}

        {drag.gapAt(status.id, tasks.length) && <div className="tk-gap" aria-hidden="true" />}

        {adding ? (
          <form className="tk-add" onSubmit={submit}>
            <input
              ref={inputRef}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What needs doing?"
              aria-label={`New task in ${status.name}`}
              maxLength={200}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.stopPropagation();
                  setAdding(false);
                  setTitle('');
                }
              }}
              // Closing on blur would swallow a half-typed task the moment you
              // clicked anywhere else, so it closes on Escape or an empty
              // submit instead — both of which are deliberate.
            />
            <div className="tk-add-foot">
              <button type="submit" className="btn primary" disabled={!title.trim()}>
                Add
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setAdding(false);
                  setTitle('');
                }}
              >
                Done
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className="tk-add-btn" onClick={() => setAdding(true)}>
            <IconPlus size={12} />
            Add a task
          </button>
        )}
      </div>
    </section>
  );
}
