import { useMemo } from 'react';
import { COLUMNS, COLUMN_BY_ID, SIZES, widthOf } from '../components/problem/columns.jsx';
import { useLocalState } from './useLocalState.js';
import { NARROW, useMediaQuery } from './useMediaQuery.js';

const STORAGE_KEY = 'table-columns';

/**
 * Three is the cap because the pinned block does not scroll: every column you
 * freeze is width the scrollable middle no longer has.
 */
export const MAX_PINNED = 3;

// The row's control strip. Always last, always frozen to the right edge — it is
// chrome, not data, and it should stay reachable however far you scroll.
export const RIGHT_PINNED = 'actions';

const DEFAULT_PINNED = ['status', 'index', 'title'];

export const defaultLayout = () =>
  COLUMNS.map((c) => ({
    id: c.id,
    show: !c.hidden,
    size: 'M',
    pin: DEFAULT_PINNED.includes(c.id),
  }));

/**
 * Reconciles a saved layout against the current column registry.
 *
 * A layout can outlive the code that produced it — someone's browser holds a
 * list from three deploys ago. Columns that no longer exist are dropped, and
 * columns added since are spliced in at their default position rather than
 * appended, so a new column shows up where it was meant to sit instead of
 * always landing after the actions column.
 */
function reconcile(saved) {
  if (!Array.isArray(saved) || !saved.length) return defaultLayout();

  let pinned = 0;
  const entries = saved
    .filter((entry) => entry && COLUMN_BY_ID[entry.id])
    .map((entry) => {
      // A stored layout can carry more pins than the cap allows if the cap ever
      // drops. Honour them left to right and ignore the rest.
      const pin = Boolean(entry.pin) && entry.id !== RIGHT_PINNED && pinned < MAX_PINNED;
      if (pin) pinned += 1;
      return {
        id: entry.id,
        // A required column stored hidden would leave the table unreadable with
        // no obvious way back.
        show: COLUMN_BY_ID[entry.id].required ? true : Boolean(entry.show),
        size: SIZES.includes(entry.size) ? entry.size : 'M',
        pin,
      };
    });

  const present = new Set(entries.map((e) => e.id));
  COLUMNS.forEach((column, defaultIndex) => {
    if (present.has(column.id)) return;
    entries.splice(Math.min(defaultIndex, entries.length), 0, {
      id: column.id,
      show: !column.hidden,
      size: 'M',
      pin: false,
    });
  });

  return entries;
}

export const pinnedCount = (layout) => layout.filter((e) => e.pin).length;

/**
 * Resolves the layout into the list the table renders from.
 *
 * Pinned columns are hoisted to the front and the actions column is forced to
 * the back, because that is what freezing means here: whatever you pin ends up
 * against the edge it is frozen to, regardless of where it sits in the list.
 *
 * `narrow` drops every pin. Freezing is a trade — width the scrollable middle
 * no longer has, in exchange for a column that stays put — and on a phone the
 * trade stops paying: the default three left pins are 422px of frozen block on
 * a 390px screen, which does not merely crowd the middle, it leaves nothing
 * that can be scrolled into view at all. Unpinned, the table scrolls sideways
 * as one piece, which is worse than a frozen title and far better than a wall.
 *
 * The order still honours the pins, so whatever you chose to freeze is what you
 * see first without scrolling.
 */
function resolve(layout, narrow) {
  const visible = layout.filter((entry) => entry.show);
  const rightPinned = visible.filter((e) => e.id === RIGHT_PINNED);
  const rest = visible.filter((e) => e.id !== RIGHT_PINNED);

  const ordered = [
    ...rest.filter((e) => e.pin),
    ...rest.filter((e) => !e.pin),
    ...rightPinned,
  ];

  // Pinned entries were just hoisted to the front, so the last one sits at
  // count - 1. That cell draws the edge shadow.
  let offset = 0;
  const lastPinnedIndex = rest.filter((e) => e.pin).length - 1;

  return ordered.map((entry, index) => {
    const column = COLUMN_BY_ID[entry.id];
    const px = column.fixed ? column.width : widthOf(column, entry.size);
    const pin = narrow ? null : entry.pin ? 'left' : entry.id === RIGHT_PINNED ? 'right' : null;
    const resolved = {
      ...column,
      size: entry.size,
      // Fixed columns are chrome — a checkbox and an icon strip. Scaling them
      // just leaves a hole.
      px,
      pin,
      pinOffset: pin === 'left' ? offset : 0,
      // The cell that draws the shadow marking where the frozen block ends.
      // Nothing is frozen when narrow, so there is no edge to mark.
      pinEdge: pin ? index === lastPinnedIndex || entry.id === RIGHT_PINNED : false,
    };
    if (pin === 'left') offset += px;
    return resolved;
  });
}

/**
 * The saved column layout plus the resolved column list the table renders from.
 *
 * Kept in localStorage rather than on the account: it is a per-screen
 * preference — the layout that fits a 27" monitor is not the one that fits a
 * laptop — and reading it synchronously means the table paints in its real
 * shape instead of flashing the default set while a request lands.
 */
export function useTableLayout() {
  const [stored, setStored] = useLocalState(STORAGE_KEY, null);
  // Only the resolved list changes on a phone. What is *stored* stays exactly
  // as chosen, so the dialog keeps showing the real layout and rotating a
  // tablet back to landscape restores the pins rather than having lost them.
  const narrow = useMediaQuery(NARROW);

  const layout = useMemo(() => reconcile(stored), [stored]);
  const columns = useMemo(() => resolve(layout, narrow), [layout, narrow]);

  return { layout, setLayout: setStored, columns };
}
