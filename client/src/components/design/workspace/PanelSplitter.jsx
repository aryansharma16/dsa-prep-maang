import { useRef } from 'react';

/**
 * The draggable edge between a side panel and the canvas.
 *
 * Pointer capture on the handle itself, so a fast drag that leaves the 6px
 * strip keeps resizing. Arrow keys resize too — a splitter that only works with
 * a mouse is a panel stuck at whatever width it happened to open at. Dragging
 * well past the minimum collapses the panel, the way Figma's do.
 *
 * `side` says which edge of the panel this sits on: 'right' for a left panel
 * (dragging right widens it), 'left' for a right panel.
 */
export function PanelSplitter({ value, min, max, onChange, onCollapse, side = 'right', label }) {
  const start = useRef(null);
  const sign = side === 'right' ? 1 : -1;

  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = { x: event.clientX, value };
    document.documentElement.classList.add('sd-resizing');
  };

  const onPointerMove = (event) => {
    if (!start.current) return;
    const next = start.current.value + (event.clientX - start.current.x) * sign;
    onChange(Math.round(Math.min(max, Math.max(min, next))));
    start.current.raw = next;
  };

  const end = (event) => {
    if (!start.current) return;
    const collapse = onCollapse && start.current.raw != null && start.current.raw < min - 80;
    start.current = null;
    document.documentElement.classList.remove('sd-resizing');
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (collapse) onCollapse();
  };

  const onKeyDown = (event) => {
    const step = event.shiftKey ? 40 : 10;
    const clamp = (v) => Math.min(max, Math.max(min, v));
    if (event.key === 'ArrowLeft') onChange(clamp(value - step * sign));
    else if (event.key === 'ArrowRight') onChange(clamp(value + step * sign));
    else return;
    event.preventDefault();
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a separator with a value is focusable by spec
    <div
      className={`sd-splitter sd-splitter-${side}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={onKeyDown}
      onDoubleClick={onCollapse}
    />
  );
}
