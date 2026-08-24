import { useCallback, useState } from 'react';

/**
 * Dragging a card between and within the board's columns.
 *
 * The gap-indicator pattern, widened from one list to
 * several. Nothing moves until the drop and a line shows where the card will
 * land — rather than the swap-on-hover the guide editor uses, which mutates the
 * list under the pointer while you are still deciding, so a drag across four
 * cards shuffles all four and the drop lands somewhere you did not choose.
 *
 * The hook holds only the drag; the caller owns the tasks and does the write.
 * `idsIn(statusId)` is how it asks what a column currently contains, and
 * `onDrop({ id, status, ids })` hands back the destination column in the order
 * it was drawn — which is exactly the shape `POST /tasks/move` takes.
 */
export function useBoardDrag({ idsIn, onDrop }) {
  /** `{ id, status }` — the card in the hand. */
  const [dragging, setDragging] = useState(null);
  /** `{ status, index }` — where the line is drawn. */
  const [dropAt, setDropAt] = useState(null);

  const reset = useCallback(() => {
    setDragging(null);
    setDropAt(null);
  }, []);

  const commit = useCallback(() => {
    if (!dragging || !dropAt) {
      reset();
      return;
    }

    const { id } = dragging;
    const status = dropAt.status;
    const before = idsIn(status);

    /*
      Within one column the index was measured against a list that still holds
      the dragged card, so every position after it is off by one once the card
      is lifted out. The same correction BlockList makes, for the same reason.
    */
    let index = dropAt.index;
    if (String(dragging.status) === String(status)) {
      const from = before.indexOf(id);
      if (from !== -1 && dropAt.index > from) index -= 1;
    }

    const ids = before.filter((other) => other !== id);
    ids.splice(Math.max(0, Math.min(index, ids.length)), 0, id);

    // A drag that ends where it started is not a write.
    const unchanged =
      String(dragging.status) === String(status) &&
      ids.length === before.length &&
      ids.every((other, i) => other === before[i]);

    if (!unchanged) onDrop({ id, status, ids });
    reset();
  }, [dragging, dropAt, idsIn, onDrop, reset]);

  /**
   * Props for one card.
   *
   * `stopPropagation` on the drag-over matters: without it the column's own
   * handler runs straight afterwards and overwrites the precise index this just
   * computed with "the end of the list".
   */
  const cardProps = useCallback(
    (id, index, statusId) => ({
      draggable: true,
      onDragStart: (event) => {
        event.dataTransfer.effectAllowed = 'move';
        // Firefox will not start a drag unless some data is set.
        event.dataTransfer.setData('text/plain', id);
        setDragging({ id, status: statusId });
      },
      onDragEnd: reset,
      onDragOver: (event) => {
        if (!dragging) return;
        event.preventDefault();
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        const after = event.clientY > rect.top + rect.height / 2;
        setDropAt({ status: statusId, index: after ? index + 1 : index });
      },
      onDrop: (event) => {
        event.preventDefault();
        event.stopPropagation();
        commit();
      },
    }),
    [dragging, commit, reset],
  );

  /** Props for the column, which catches everything the cards did not. */
  const columnProps = useCallback(
    (statusId, count) => ({
      onDragOver: (event) => {
        if (!dragging) return;
        event.preventDefault();
        // Only when the pointer is past the last card — a card's own handler
        // has already stopped the event if it was over one.
        setDropAt({ status: statusId, index: count });
      },
      onDrop: (event) => {
        event.preventDefault();
        commit();
      },
    }),
    [dragging, commit],
  );

  /** Is the line drawn immediately before card `index` of this column? */
  const gapAt = useCallback(
    (statusId, index) =>
      Boolean(dropAt) && String(dropAt.status) === String(statusId) && dropAt.index === index,
    [dropAt],
  );

  return { dragging, dropAt, cardProps, columnProps, gapAt, reset };
}
