import { useEffect, useState } from 'react';

/**
 * The element that actually scrolls above a node, as `[ref, container]`.
 *
 * A page inside the app shell does not scroll the window — `.content` owns the
 * scrollbar, and everything above it is `height: 100%`. Anything that reacts to
 * scrolling from inside a page therefore has to find that element rather than
 * listen on `window`, which never fires and fails silently: a scroll-spy that
 * simply never updates looks like a styling bug, not a missing listener.
 *
 * Found by walking up and asking each ancestor whether it can scroll, rather
 * than hardcoding `.content`. The shell is free to change class names or grow
 * another scroll region without this quietly attaching to the wrong one, and a
 * component that ends up somewhere with no scrolling ancestor gets the document
 * scroller, which is the right answer there.
 *
 * `ref` is a *callback* ref, not an object one, and that is the whole subtlety.
 * A page that renders a loading state before its real markup has no node to
 * walk up from on first mount; an effect keyed on a ref object would run once,
 * against nothing, and settle on the document scroller forever. A callback ref
 * fires again when the real node attaches, so the search re-runs then.
 *
 * The container comes back as state rather than a ref for the same reason:
 * callers have effects that must re-run once it is known.
 */
export function useScrollContainer() {
  // The setter is stable, so it is safe to pass straight to `ref` — React would
  // otherwise detach and reattach on every render.
  const [node, setNode] = useState(null);
  const [container, setContainer] = useState(null);

  useEffect(() => {
    if (!node) {
      setContainer(null);
      return;
    }

    let current = node.parentElement;
    while (current && current !== document.body) {
      const { overflowY } = getComputedStyle(current);
      if (overflowY === 'auto' || overflowY === 'scroll') {
        setContainer(current);
        return;
      }
      current = current.parentElement;
    }
    setContainer(document.scrollingElement || document.documentElement);
  }, [node]);

  return [setNode, container];
}

/** How far through `el` the reader is, 0 to 1. 1 when there is nothing to scroll. */
export function scrollProgress(el) {
  const scrollable = el.scrollHeight - el.clientHeight;
  return scrollable > 8 ? Math.min(1, Math.max(0, el.scrollTop / scrollable)) : 1;
}
