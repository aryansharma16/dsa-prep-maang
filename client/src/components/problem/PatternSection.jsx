import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { IconChevronRight, IconInfo } from '../ui/Icons.jsx';
import { ProblemRow } from './ProblemRow.jsx';
import { cellProps } from './cellProps.js';

export const PatternSection = forwardRef(function PatternSection(
  {
    group,
    index,
    columns,
    open,
    onToggle,
    onOpenGuide,
    cursorId,
    pickedId,
    onFocusRow,
    openNotesId,
    onToggleNotes,
  },
  ref,
) {
  const pct = group.total ? Math.round((group.solved / group.total) * 100) : 0;

  /*
    The table is fixed-layout, so the colgroup widths are honoured exactly.
    min-width is the sum of every column, which makes the wrapper scroll once
    the chosen columns no longer fit instead of squeezing them all thinner.

    The title column deliberately gets no width: as the one auto column it
    absorbs whatever is left over, so a narrow selection fills the row and a
    wide one still gives the title the width it was configured for.
  */
  const minWidth = columns.reduce((sum, c) => sum + c.px, 0);

  /*
    Which edges are actually cut off right now. The frozen columns only cast a
    shadow when there is something hidden behind them — otherwise a table that
    fits its container would sprout two shadows over nothing.
  */
  const wrapRef = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    setEdges({
      left: el.scrollLeft > 1,
      // -1 absorbs the sub-pixel rounding a fractional container width leaves.
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    // Collapsing the sidebar resizes the wrapper without scrolling it.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, [measure, open, minWidth]);

  return (
    <section
      className={`pattern ${open ? 'open' : ''}`}
      ref={ref}
      id={`pattern-${group.slug}`}
    >
      {/*
        The technique chips live inside the header button, not after it. Kept
        outside, the hover highlight stopped above them and the chips read as
        colliding with the heading. All spans, so this stays valid inside a
        button.

        The guide button is a sibling of that button rather than a child, for
        the same reason in reverse: a <button> inside a <button> is invalid, and
        every descendant here is a span precisely so it stays legal. The <h2> is
        the flex row that holds the two side by side.
      */}
      <h2 className="pattern-heading">
      <button className="pattern-head" onClick={onToggle} aria-expanded={open}>
        <span className="pattern-head-main">
          <span className={`chev ${open ? 'open' : ''}`}>
            <IconChevronRight size={13} />
          </span>

          <span className="pattern-title">
            <span className="pattern-name">
              <span className="step">{String(index + 1).padStart(2, '0')}</span>
              {group.name}
            </span>
            <span className="pattern-blurb">{group.blurb}</span>
          </span>

          <span className="pattern-meter">
            <span className="pattern-frac">
              {group.solved}/{group.total}
            </span>
            <span className="bar">
              <span style={{ width: `${pct}%` }} />
            </span>
            <span className="pct">{pct}%</span>
          </span>
        </span>

        {open && group.keyTechniques?.length > 0 && (
          <span className="techniques">
            {group.keyTechniques.map((t) => (
              <span className="technique" key={t}>
                {t}
              </span>
            ))}
          </span>
        )}
      </button>

      <button
        className="pattern-info"
        onClick={onOpenGuide}
        title={`About ${group.name}`}
        aria-label={`About ${group.name}`}
      >
        <IconInfo size={15} />
      </button>
      </h2>

      {open && (
        <>
          <div
            ref={wrapRef}
            className={`tablewrap ${edges.left ? 'cut-left' : ''} ${
              edges.right ? 'cut-right' : ''
            }`}
          >
            <table className="problems" style={{ minWidth }}>
              <colgroup>
                {columns.map((column) => (
                  <col key={column.id} style={column.grow ? undefined : { width: column.px }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column.id} {...cellProps(column)}>
                      {column.head ?? column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.problems.map((problem, i) => (
                  <ProblemRow
                    key={problem._id}
                    problem={problem}
                    index={i}
                    columns={columns}
                    isCursor={cursorId === problem._id}
                    isPicked={pickedId === problem._id}
                    onFocus={() => onFocusRow(problem._id)}
                    notesOpen={openNotesId === problem._id}
                    onToggleNotes={() => onToggleNotes(problem._id)}
                  />
                ))}
                {group.problems.length === 0 && (
                  <tr>
                    <td
                      colSpan={columns.length}
                      style={{ padding: '18px 14px', color: 'var(--text-3)' }}
                    >
                      No problems match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
});
