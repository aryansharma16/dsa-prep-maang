import { useCallback, useEffect, useState } from 'react';
import { useScrollContainer } from '../../hooks/useScrollContainer.js';

/**
 * "On this page" for a Learn topic.
 *
 * The same scroll-spy the guide reader uses, moved off that reader's own
 * scrollbar and onto the app shell's. The reader is a full-viewport dialog that
 * owns its scroll region; a Learn topic is an ordinary page, and the element
 * that scrolls is `.content` several levels up — `useScrollContainer` is what
 * finds it. Listening on `window` here would attach to something that never
 * fires, and a rail that simply never moves reads as a CSS bug.
 *
 * The active rule is unchanged: a heading becomes current once it reaches the
 * upper quarter of the scroll region, which is where you are actually reading,
 * not when it touches the top edge. Positions come from `getBoundingClientRect`
 * rather than `offsetTop` because the headings sit several wrappers deep and
 * `offsetTop` would be measured against whichever of those happens to be
 * positioned.
 *
 * What did change is *when* those rectangles are read. Measuring every heading
 * on every frame is a `getElementById` and a layout read per heading per frame
 * — perfectly cheap on a settled page, and a forced synchronous reflow the
 * moment anything else on the page has dirtied layout in the same frame. The
 * positions are fixed while you scroll, so they are measured once, converted
 * to offsets *within the scroll content*, and compared against `scrollTop`
 * from then on. Re-measured on resize, and whenever `scrollHeight` moves —
 * which is what an image landing, a code tab switching or a font swapping in
 * all look like from here, and is one number to read rather than twenty.
 */
export function LearnToc({ headings }) {
  const [railRef, container] = useScrollContainer();
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    if (!container || !headings.length) return undefined;

    let frame = 0;
    let offsets = [];
    let measuredAt = -1;

    /*
      Each heading's distance from the top of the scrolled content, which is
      the thing that does not change as you scroll. `rect.top - box.top` is the
      heading's position within the viewport of the scroller, and adding
      `scrollTop` back turns that into a position within the content.
    */
    const measure = () => {
      const box = container.getBoundingClientRect();
      const base = box.top - container.scrollTop;
      offsets = headings.map((heading) => ({
        id: heading.id,
        top: (document.getElementById(heading.id)?.getBoundingClientRect().top ?? 0) - base,
      }));
      measuredAt = container.scrollHeight;
    };

    const read = () => {
      frame = 0;
      // The page grew or shrank under us — a code tab swapped, an image landed,
      // a web font arrived. Cheaper to notice here than to re-measure blindly.
      if (container.scrollHeight !== measuredAt) measure();
      const line = container.scrollTop + container.clientHeight * 0.25;
      let current = offsets[0].id;
      for (const heading of offsets) if (heading.top <= line) current = heading.id;
      // React bails out on an unchanged string, so most frames stop here.
      setActiveId(current);
    };

    // rAF-throttled: scroll fires far faster than a paint.
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };

    // Resize changes the layout itself, so the offsets go rather than being
    // trusted until the next scroll.
    const onResize = () => {
      measure();
      onScroll();
    };

    measure();
    read();
    container.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [container, headings]);

  /*
    `replaceState` rather than a hash link or `navigate`. The section becomes
    copyable from the address bar, which is the whole point of anchors in a
    reference, but it must not add forty history entries on the way down a page
    — Back should leave the topic, not crawl back up it.
  */
  const jumpTo = useCallback((id) => {
    document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    window.history.replaceState(null, '', `#${id}`);
  }, []);

  return (
    <nav className="learn-toc" aria-label="Sections on this page" ref={railRef}>
      {headings.length > 0 && (
        <>
          <p className="learn-toc-label">On this page</p>
          <ul>
            {headings.map((heading) => (
              <li key={heading.id}>
                <button
                  type="button"
                  className={heading.id === activeId ? 'on' : ''}
                  aria-current={heading.id === activeId ? 'true' : undefined}
                  onClick={() => jumpTo(heading.id)}
                >
                  {heading.text}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </nav>
  );
}
