import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * A textarea that is exactly as tall as its text.
 *
 * The editor writes in the document's own shapes — a heading looks like a
 * heading while you type it — and a fixed-height box with an inner scrollbar
 * breaks that illusion the moment a paragraph runs past three lines. Growing
 * the element keeps the canvas honest: what you are looking at is the height the
 * block will occupy.
 *
 * Measured by collapsing to `auto` first, because `scrollHeight` on an element
 * that is already taller than its content returns the *current* height, so
 * deleting text would never shrink it back.
 */
export function AutoTextarea({ value, minRows = 1, onChange, ...rest }) {
  const ref = useRef(null);

  const resize = () => {
    const node = ref.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${node.scrollHeight}px`;
  };

  // Layout effect, not effect: a resize after paint is a visible jump on the
  // first render of a long note.
  useLayoutEffect(resize, [value]);

  // Wrapping changes with the width, so the height has to be recomputed when
  // the pane is resized — dragging the window narrower otherwise clips the tail
  // of every paragraph.
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    />
  );
}
