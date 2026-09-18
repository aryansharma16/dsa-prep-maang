import { useBoardDrag } from '../../hooks/useBoardDrag.js';
import { StageColumn } from './StageColumn.jsx';

/**
 * The board.
 *
 * Lanes scroll horizontally as a group and each scrolls its own cards
 * vertically, the arrangement the task board uses and for the same reason: one
 * page scroll puts the header of the lane you are reading off the top of the
 * screen exactly when you need to know which lane it is.
 *
 * The drag is `useBoardDrag`, unchanged. Its `onDrop` hands back
 * `{ id, status, ids }` — the destination lane in the order it was drawn — and
 * `POST /applications/move` takes that shape because the task board's `/move`
 * already did. Reusing the hook is what makes the drag *the* status update:
 * dropping a card into Screening writes `reached.screening` and a timeline node
 * with no form in the way, which is the entire argument for a board here.
 */
export function PipelineView({ columns, byColumn, onMove, onAdd, onOpen }) {
  const drag = useBoardDrag({
    idsIn: (columnKey) => (byColumn.get(columnKey) || []).map((app) => app.id),
    onDrop: onMove,
  });

  return (
    <div className={`ap-board ${drag.dragging ? 'is-dragging' : ''}`}>
      {columns.map((column) => (
        <StageColumn
          key={column.key}
          column={column}
          apps={byColumn.get(column.key) || []}
          drag={drag}
          onAdd={(company) => onAdd(company, column.key)}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
