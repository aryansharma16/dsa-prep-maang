import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { cpApi } from '../../api/index.js';
import { IconArrowLeft, IconClose, IconExternal } from '../ui/Icons.jsx';
import { useDialog } from '../ui/useDialog.js';
import { GuideBlocks, guideHeadings } from '../problem/GuideBlocks.jsx';

/**
 * The pattern reference for one CP technique.
 *
 * Two things are on screen here and only one of them always exists. Every
 * pattern carries a **brief** — the invariant, when it fires, its complexity,
 * the traps, and a reading list — which ships with the ladder and renders on the
 * first frame. Twelve of the forty-nine also have a full **guide**, which is a
 * couple of thousand words with Java and C++ implementations and is fetched.
 *
 * So the brief is the page and the guide is what follows it, rather than the
 * guide being the page and the brief a fallback. That ordering is the point: a
 * pattern with no long-form guide still opens something worth reading, and does
 * not look like a broken door.
 *
 * The shell is the roadmap's reader — `.reader-*`, laid out in app.css — rather
 * than a panel of its own: same job, same reading problem, and an earlier
 * version of this file that invented its own markup shipped class names no
 * stylesheet had ever defined, so the "guide" opened as unstyled prose across
 * the full width of the window. What is CP-specific is the palette, and that
 * arrives through `.cp-root` on the overlay.
 */

/** Guides are prose keyed by slug and never change within a session. */
const cache = new Map();

function useCPGuide(slug) {
  const [guide, setGuide] = useState(() => cache.get(slug) ?? null);
  const [loading, setLoading] = useState(() => !cache.has(slug));

  useEffect(() => {
    if (cache.has(slug)) {
      setGuide(cache.get(slug));
      setLoading(false);
      return undefined;
    }
    let live = true;
    setLoading(true);
    cpApi
      .guide(slug)
      .then((data) => {
        cache.set(slug, data);
        if (live) setGuide(data);
      })
      .catch(() => {
        /*
          A 404 here is an ordinary answer, not a failure — most patterns have
          no long-form guide yet. Cached as null so re-opening the same section
          does not re-ask, and rendered as the brief alone.
        */
        cache.set(slug, null);
        if (live) setGuide(null);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [slug]);

  return { guide, loading };
}

function Brief({ brief }) {
  if (!brief) return null;
  const has = brief.invariant || brief.whenItFires || brief.complexity || brief.traps?.length;
  if (!has) return null;

  return (
    <div className="cp-brief">
      {brief.invariant && (
        <div className="cp-brief-block invariant">
          <span className="cp-brief-label mono">THE INVARIANT</span>
          <p>{brief.invariant}</p>
        </div>
      )}

      <div className="cp-brief-grid">
        {brief.whenItFires && (
          <div className="cp-brief-block">
            <span className="cp-brief-label mono">WHEN IT FIRES</span>
            <p>{brief.whenItFires}</p>
          </div>
        )}
        {brief.complexity && (
          <div className="cp-brief-block">
            <span className="cp-brief-label mono">COMPLEXITY</span>
            <p className="mono">{brief.complexity}</p>
          </div>
        )}
      </div>

      {brief.traps?.length > 0 && (
        <div className="cp-brief-block traps">
          <span className="cp-brief-label mono">WHAT GOES WRONG</span>
          <ul>
            {brief.traps.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {brief.links?.length > 0 && (
        <div className="cp-brief-block">
          <span className="cp-brief-label mono">READ MORE</span>
          <ul className="cp-brief-links">
            {brief.links.map((l) => (
              <li key={l.url}>
                <a href={l.url} target="_blank" rel="noreferrer">
                  {l.label}
                  <IconExternal size={11} />
                </a>
                {l.source && <span className="dim"> {l.source}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function CPGuideReader({ pattern, onClose }) {
  const { guide, loading } = useCPGuide(pattern.slug);

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

  return (
    /*
      `.cp-root` on the overlay, not on the page underneath it — the wrapper is
      tokens only, so it re-skins this dialog wherever it is mounted. `.cp-reader`
      is what adds the glass on top of them.
    */
    <div className="reader-overlay cp-root cp-reader">
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
            Pro Coder
          </button>

          <span className="reader-crumb">
            {pattern.badge && <span className="reader-step mono">{pattern.badge}</span>}
            {pattern.name}
          </span>

          {/* Which rung of the ladder this technique belongs to. The one piece
              of the ladder's vocabulary the roadmap's header has no slot for. */}
          {(pattern.tierLabel || pattern.tier) && (
            <span className="cp-reader-tier mono" data-tier={pattern.tier}>
              {pattern.tierLabel || pattern.tier}
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
                <h1 id={titleId}>{pattern.name}</h1>
                <p>{pattern.blurb}</p>
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

              {/* Always present, and always first. */}
              <Brief brief={pattern.brief} />

              {pattern.prereqs?.length > 0 && (
                <p className="cp-prereqs">
                  <span className="cp-brief-label mono">ASSUMES</span> {pattern.prereqs.join(' · ')}
                </p>
              )}

              {loading && (
                <div className="guide-loading">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div className="skeleton" key={i} />
                  ))}
                </div>
              )}

              {!loading && guide && (
                <>
                  <hr className="cp-guide-rule" />
                  <GuideBlocks blocks={guide.blocks} />
                </>
              )}

              {!loading && !guide && (
                <p className="hint dim" style={{ marginTop: 24 }}>
                  No long-form guide for this pattern yet — the brief above and the linked reading
                  are what there is. The twelve core patterns have full write-ups with Java and C++
                  implementations.
                </p>
              )}
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}
