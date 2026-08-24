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
 */
export function LearnToc({ headings }) {
  const [railRef, container] = useScrollContainer();
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    if (!container || !headings.length) return undefined;

    let frame = 0;
    const read = () => {
      frame = 0;
      const box = container.getBoundingClientRect();
      const line = box.top + container.clientHeight * 0.25;
      let current = headings[0].id;
      for (const heading of headings) {
        const node = document.getElementById(heading.id);
        if (node && node.getBoundingClientRect().top <= line) current = heading.id;
      }
      setActiveId(current);
    };

    // rAF-throttled: scroll fires far faster than a paint, and this reads
    // layout for every heading on the page each time it runs.
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };

    read();
    container.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
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
