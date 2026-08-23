import { useState } from 'react';
import { IconPlus } from '../ui/Icons.jsx';
import { StatusColumn } from './StatusColumn.jsx';
import { useBoardDrag } from '../../hooks/useBoardDrag.js';

/**
 * The board.
 *
 * Columns scroll horizontally as a group and each scrolls its own cards
 * vertically, which is what keeps the headers in place while a long column is
 * read. The alternative — one page scroll — puts the column you are reading's
 * heading off the top of the screen exactly when you need to know which column
 * it is.
 */
export function BoardView({
  statuses,
  byStatus,
  solved,
  progressOf,
  onMove,
  onAdd,
  onOpen,
  onMoveTo,
  onDelete,
  onChange,
  onEditColumn,
  onDeleteColumn,
  onAddColumn,
  onReorderColumns,
}) {
  const drag = useBoardDrag({
    idsIn: (statusId) => (byStatus.get(String(statusId)) || []).map((task) => task.id),
    onDrop: onMove,
  });

  /*
    Reordering the columns themselves — a second, much simpler drag.

    It does not need the gap machinery the cards use: there are at most twelve
    columns, they are wide, and a swap on drop is unambiguous when the thing you
    are aiming at is 288px across. The card version earns its complexity because
    a column of cards is a tall list of near-identical targets.
  */
  const [colDragging, setColDragging] = useState(null);
  const [colOver, setColOver] = useState(null);

  const commitColumns = (targetId) => {
    if (!colDragging || colDragging === String(targetId)) return;
    const ids = statuses.map((status) => String(status.id));
    const from = ids.indexOf(colDragging);
    const to = ids.indexOf(String(targetId));
    if (from === -1 || to === -1) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    onReorderColumns(ids);
  };

  const colDrag = {
    dragging: colDragging,
    over: colOver,
    handleProps: (statusId) => ({
      draggable: true,
      onDragStart: (event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', `col:${statusId}`);
        setColDragging(String(statusId));
      },
      onDragEnd: () => {
        setColDragging(null);
        setColOver(null);
      },
    }),
    dropProps: (statusId) => ({
      onDragOver: (event) => {
        if (!colDragging) return;
        event.preventDefault();
        setColOver(String(statusId));
      },
      onDrop: (event) => {
        if (!colDragging) return;
        // Beat the card handler to it — this is a column move, not a card one.
        event.preventDefault();
        event.stopPropagation();
        commitColumns(statusId);
        setColDragging(null);
        setColOver(null);
      },
    }),
  };

  return (
    <div className={`tk-board ${drag.dragging ? 'is-dragging' : ''}`}>
      {statuses.map((status) => (
        <StatusColumn
          key={status.id}
          status={status}
          statuses={statuses}
          tasks={byStatus.get(String(status.id)) || []}
          solved={solved}
          progressOf={progressOf}
          drag={drag}
          onAdd={(title) => onAdd(title, status.id)}
          onOpen={onOpen}
          onMove={onMoveTo}
          onDelete={onDelete}
          onChange={onChange}
          onEditColumn={onEditColumn}
          onDeleteColumn={onDeleteColumn}
          colDrag={colDrag}
        />
      ))}

      {/* Last, and deliberately not styled as a column — it is an action, and a
          fifth empty column would read as a stage the work passes through. */}
      <button type="button" className="tk-col-add" onClick={onAddColumn}>
        <IconPlus size={13} />
        Add column
      </button>
    </div>
  );
}
