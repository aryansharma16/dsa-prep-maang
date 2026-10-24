import { useCallback, useEffect, useRef, useState } from 'react';

/** How close to a scroll area's edge, in px, before a held card starts scrolling it. */
const EDGE = 80;
/** Pixels per frame at the very edge; it eases off linearly towards `EDGE`. */
const MAX_SPEED = 22;

const canScroll = (el, axis) => {
  const style = getComputedStyle(el);
  const overflow = axis === 'x' ? style.overflowX : style.overflowY;
  if (!/(auto|scroll|overlay)/.test(overflow) && el !== document.scrollingElement) return false;
  return axis === 'x' ? el.scrollWidth > el.clientWidth : el.scrollHeight > el.clientHeight;
};

/** Speed for a pointer at `pos` inside [start, end]: negative near start, positive near end. */
const edgeSpeed = (pos, start, end) => {
  if (pos < start + EDGE) return -MAX_SPEED * Math.min(1, (start + EDGE - pos) / EDGE);
  if (pos > end - EDGE) return MAX_SPEED * Math.min(1, (pos - (end - EDGE)) / EDGE);
  return 0;
};

/**
 * Scrolls whatever is under a held card when it nears an edge.
 *
 * Native drag-and-drop barely auto-scrolls nested scroll areas, and on Linux
 * the wheel is dead while a drag is in progress — so without this, a card at
 * the bottom of a long column cannot reach a lane that is off screen.
 *
 * The areas considered are the ones around the pointer and the ones around the
 * card being dragged — the second matters because the board's horizontal
 * scroller can end well short of the window, so a pointer pushed to the screen
 * edge is no longer over it. Per axis, the innermost area that can still move
 * that way wins. Edges are measured on the on-screen part of each area, and a
 * pointer past an edge counts as full speed.
 */
const ancestors = (el) => {
  const list = [];
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) list.push(node);
  return list;
};

function useDragAutoScroll(active, sourceRef) {
  useEffect(() => {
    if (!active) return undefined;
    let point = null;
    let frame = 0;

    const onDragOver = (event) => {
      point = { x: event.clientX, y: event.clientY, target: event.target };
    };

    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (!point) return;
      const done = { x: false, y: false };
      const home = new Set(ancestors(sourceRef.current));
      const areas = [...new Set([...ancestors(point.target), ...home])];
      for (const el of areas) {
        if (done.x && done.y) break;
        const rect = el === document.documentElement
          ? { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }
          : el.getBoundingClientRect();
        const top = Math.max(rect.top, 0);
        const bottom = Math.min(rect.bottom, window.innerHeight);
        const left = Math.max(rect.left, 0);
        const right = Math.min(rect.right, window.innerWidth);

        for (const axis of ['x', 'y']) {
          if (done[axis] || !canScroll(el, axis)) continue;
          // An unrelated area (another column, say) only scrolls when the pointer is level with it.
          // The board the card came from always does: it can be shorter than the window, and
          // pushing the card to the screen edge below it should still scroll it.
          const level = axis === 'x' ? point.y >= top && point.y <= bottom : point.x >= left && point.x <= right;
          if (!level && !home.has(el)) continue;
          const speed = axis === 'x' ? edgeSpeed(point.x, left, right) : edgeSpeed(point.y, top, bottom);
          if (!speed) continue;
          const before = axis === 'x' ? el.scrollLeft : el.scrollTop;
          if (axis === 'x') el.scrollLeft += speed;
          else el.scrollTop += speed;
          // Already at the end that way — let an outer area take the scroll instead.
          if ((axis === 'x' ? el.scrollLeft : el.scrollTop) !== before) done[axis] = true;
        }
      }
    };

    document.addEventListener('dragover', onDragOver, true);
    frame = requestAnimationFrame(tick);
    return () => {
      document.removeEventListener('dragover', onDragOver, true);
      cancelAnimationFrame(frame);
    };
  }, [active, sourceRef]);
}

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

  /** The card element in the hand, so auto-scroll can find the areas around it. */
  const sourceRef = useRef(null);
  useDragAutoScroll(Boolean(dragging), sourceRef);

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
        sourceRef.current = event.currentTarget;
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
