/**
 * Turns a resolved column into the className/style a <th> or <td> needs.
 *
 * Frozen columns are plain `position: sticky` cells, so the offset has to be
 * spelled out per cell — and the header and body cells have to agree exactly,
 * or the two halves of a frozen column drift apart while scrolling. One helper,
 * used by both, is what keeps them in step.
 */
export function cellProps(column) {
  const classes = [column.className || ''];

  if (column.pin === 'left') classes.push('pin pin-left');
  if (column.pin === 'right') classes.push('pin pin-right');
  if (column.pin && column.pinEdge) classes.push('pin-edge');

  const style =
    column.pin === 'left'
      ? { left: column.pinOffset }
      : column.pin === 'right'
        ? { right: 0 }
        : undefined;

  return { className: classes.filter(Boolean).join(' '), style };
}
