import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { IconBook, IconChevronRight } from '../ui/Icons.jsx';
import { cellProps } from '../problem/cellProps.js';
import { CPProblemRow } from './CPProblemRow.jsx';

/**
 * One collapsible group of the ladder — a tier, or a pattern, depending on which
 * grouping is on.
 *
 * One component for both rather than two, because the header is the only part
 * that differs and it differs by two lines. `kind` decides what the meta strip
 * says: a tier leads with its rating band, a pattern leads with its technique
 * summary. Everything below the header is the same table.
 */
export const CPSection = forwardRef(function CPSection(
  {
    group,
    kind,
    columns,
    open,
    onToggle,
    onOpenGuide,
    cursorId,
    pickedId,
    onFocusRow,
    openNotesId,
    onToggleNotes,
    tierLabel,
    patternName,
  },
  ref,
) {
  const pct = group.total ? Math.round((group.solved / group.total) * 100) : 0;

  /*
    The table is fixed-layout, so the colgroup widths are honoured exactly.
    min-width is the sum of every column, which makes the wrapper scroll once
    the chosen columns no longer fit instead of squeezing them all thinner.
  */
  const minWidth = columns.reduce((sum, c) => sum + c.px, 0);

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
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, [measure, open, minWidth]);

  const isTier = kind === 'tier';

  return (
    <section
      className={`cp-section ${open ? 'open' : ''} ${isTier ? 'is-tier' : 'is-pattern'}`}
      ref={ref}
      id={`cp-${group.slug}`}
      data-tier={isTier ? group.slug : group.tier}
    >
      {/*
        The guide button is a sibling of the header button rather than a child:
        a <button> inside a <button> is invalid, and every descendant of the
        header is a span precisely so it stays legal. The <h2> is the flex row
        holding the two side by side.
      */}
      <h2 className="cp-heading">
        <button className="cp-head" onClick={onToggle} aria-expanded={open}>
          <span className="cp-head-main">
            <span className={`chev ${open ? 'open' : ''}`}>
              <IconChevronRight size={13} />
            </span>

            <span className="cp-head-title">
              <span className="cp-head-name">
                <span className="cp-step mono">{group.badge}</span>
                {group.name}
                {isTier && group.cfRank && (
                  <span className="cp-rank-tag" data-tier={group.slug}>
                    {group.cfRank}
                  </span>
                )}
              </span>
              <span className="cp-head-blurb">{isTier ? group.focus : group.blurb}</span>
            </span>

            <span className="cp-meter">
              {isTier && (
                <span className="cp-band mono" title="Codeforces rating band">
                  {group.min}
                  {group.max ? `–${group.max}` : '+'}
                </span>
              )}
              <span className="cp-frac mono">
                {group.solved}/{group.total}
              </span>
              <span className="bar">
                <span style={{ width: `${pct}%` }} />
              </span>
              <span className="pct mono">{pct}%</span>
            </span>
          </span>

          {open && !isTier && group.keyTechniques?.length > 0 && (
            <span className="techniques">
              {group.keyTechniques.map((t) => (
                <span className="technique" key={t}>
                  {t}
                </span>
              ))}
            </span>
          )}
        </button>

        {/*
          Only where there is something to read. Twelve of the forty-nine
          patterns have a long-form guide, and a button that opened an empty
          drawer on the other thirty-seven would be worse than no button — the
          structured brief is shown in the reader either way.
        */}
        {!isTier && (
          <button
            className="cp-info"
            onClick={onOpenGuide}
            title={group.hasGuide ? `Guide — ${group.name}` : `About ${group.name}`}
            aria-label={`About ${group.name}`}
          >
            <IconBook size={15} />
            {group.hasGuide && <i className="cp-info-dot" />}
          </button>
        )}
      </h2>

      {open && (
        <div
          ref={wrapRef}
          className={`tablewrap ${edges.left ? 'cut-left' : ''} ${edges.right ? 'cut-right' : ''}`}
        >
          <table className="problems cp-table" style={{ minWidth }}>
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
                <CPProblemRow
                  key={problem._id}
                  problem={problem}
                  index={i}
                  columns={columns}
                  isCursor={cursorId === problem._id}
                  isPicked={pickedId === problem._id}
                  onFocus={() => onFocusRow(problem._id)}
                  notesOpen={openNotesId === problem._id}
                  onToggleNotes={() => onToggleNotes(problem._id)}
                  tierLabel={tierLabel}
                  patternName={patternName}
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
      )}
    </section>
  );
});
