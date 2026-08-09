import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useGuide } from '../../hooks/useGuide.js';
import { IconArrowLeft, IconClose } from '../ui/Icons.jsx';
import { useDialog } from '../ui/useDialog.js';
import { GuideBlocks, guideHeadings } from './GuideBlocks.jsx';

/**
 * The pattern reference, opened from the ⓘ on a section heading.
 *
 * A guide is a two-thousand-word essay with code, tables and callouts, so this
 * takes the whole viewport rather than sharing it: a side rail for the headings,
 * one column of prose held to a readable measure, and nothing else competing.
 * It is still a dialog — Escape closes it and the roadmap keeps its scroll
 * position underneath — so reading one costs you nothing.
 *
 * `pattern` is what the roadmap already knows, so the title, blurb and progress
 * render on the first frame instead of waiting on the request.
 */
export function GuideReader({ pattern, onClose }) {
  const { data, loading, error } = useGuide(pattern.slug);
  const guide = data?.guide;

  const panelRef = useRef(null);
  const scrollRef = useRef(null);
  const titleId = useId();

  // The scroll region takes initial focus rather than the first button, so
  // PageDown and the arrow keys scroll the guide the moment it opens.
  useDialog(panelRef, { onClose, initialFocus: scrollRef });

  const headings = useMemo(() => guideHeadings(guide?.blocks), [guide]);
  const [activeId, setActiveId] = useState('');
  const [progress, setProgress] = useState(0);

  /*
    Scroll-spy and the progress rule, off one rAF-throttled listener. Positions
    are read from the rects rather than offsetTop: the headings sit several
    wrappers deep, and offsetTop would be measured against whichever of those
    happens to be positioned.
  */
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return undefined;

    let frame = 0;
    const read = () => {
      frame = 0;
      const scrollable = root.scrollHeight - root.clientHeight;
      setProgress(scrollable > 8 ? Math.min(1, root.scrollTop / scrollable) : 1);

      if (!headings.length) return;
      // A heading counts as current once it reaches the upper quarter, which is
      // where you are actually reading — not when it touches the top edge.
      const line = root.getBoundingClientRect().top + root.clientHeight * 0.25;
      let current = headings[0].id;
      for (const heading of headings) {
        const node = document.getElementById(heading.id);
        if (node && node.getBoundingClientRect().top <= line) current = heading.id;
      }
      setActiveId(current);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };

    read();
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      root.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [headings]);

  const jumpTo = useCallback((id) => {
    document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }, []);

  const pct = pattern.total ? Math.round((pattern.solved / pattern.total) * 100) : 0;
  const step = Number.isInteger(pattern.index) ? String(pattern.index + 1).padStart(2, '0') : '';

  return (
    <div className="reader-overlay">
      <div
        className="reader"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
        tabIndex={-1}
      >
        <header className="reader-head">
          <button type="button" className="reader-back" onClick={onClose}>
            <IconArrowLeft size={13} />
            Roadmap
          </button>

          <span className="reader-crumb">
            {step && <span className="reader-step mono">{step}</span>}
            {guide?.title || pattern.name}
          </span>

          {pattern.total > 0 && (
            <span className="reader-meter" title={`${pattern.solved} of ${pattern.total} solved`}>
              <span className="bar">
                <span style={{ width: `${pct}%` }} />
              </span>
              <span className="mono">
                {pattern.solved}/{pattern.total}
              </span>
            </span>
          )}

          <span className="reader-esc">
            <kbd className="mono">Esc</kbd>
          </span>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close guide">
            <IconClose size={14} />
          </button>
        </header>

        {/* How far through the guide you are. Transform-only, so scrolling never
            lays out anything. */}
        <div className="reader-rule" aria-hidden="true">
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>

        <div className="reader-main">
          <nav className="reader-toc" aria-label="Sections in this guide">
            {headings.length > 0 && (
              <>
                <p className="reader-toc-label">On this page</p>
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

          <div className="reader-scroll" ref={scrollRef} tabIndex={0}>
            <article className="reader-col">
              <div className="reader-lede">
                <h1 id={titleId}>{guide?.title || pattern.name}</h1>
                <p>{guide?.summary || pattern.blurb}</p>
                {pattern.keyTechniques?.length > 0 && (
                  <div className="reader-chips">
                    {pattern.keyTechniques.map((technique) => (
                      <span className="technique" key={technique}>
                        {technique}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {loading && (
                <div className="guide-loading">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div className="skeleton" key={i} />
                  ))}
                </div>
              )}

              {!loading && error && <div className="alert">{error}</div>}

              {!loading && !error && !guide && (
                <p className="hint">
                  No guide written for this pattern yet. The techniques above are what it
                  comes down to.
                </p>
              )}

              {!loading && !error && guide && <GuideBlocks blocks={guide.blocks} />}
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}
