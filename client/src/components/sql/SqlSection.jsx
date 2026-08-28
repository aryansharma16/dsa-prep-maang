import { forwardRef, useMemo } from 'react';
import { IconChevronRight } from '../ui/Icons.jsx';
import { cellProps } from '../problem/cellProps.js';
import { SqlProblemRow } from './SqlProblemRow.jsx';

/**
 * One group of problems, whichever spine is showing.
 *
 * `kind` is the only thing that differs between grouping by category and
 * grouping by difficulty, and it changes exactly one thing: the strip of text
 * under the heading. A second component for the second spine would have been
 * two files disagreeing about a table.
 */
export const SqlSection = forwardRef(function SqlSection(
  { group, kind, columns, open, onToggle, onOpen, categoryLabel },
  ref,
) {
  const pct = group.total ? Math.round((group.solved / group.total) * 100) : 0;

  /*
    The table is fixed-layout, so the colgroup widths are honoured exactly.
    `minWidth` is the sum of every column, which makes the wrapper scroll once
    the chosen columns no longer fit rather than squeezing them all thinner.
  */
  const minWidth = useMemo(() => columns.reduce((sum, c) => sum + c.px, 0), [columns]);

  return (
    <section
      className={`sql-section ${open ? 'open' : ''}`}
      ref={ref}
      id={`sql-${group.slug}`}
      data-category={kind === 'category' ? group.slug : undefined}
      data-difficulty={kind === 'difficulty' ? group.slug : undefined}
    >
      <h2 className="sql-heading">
        <button type="button" className="sql-head" onClick={onToggle} aria-expanded={open}>
          <span className="sql-head-main">
            <span className={`chev ${open ? 'open' : ''}`}>
              <IconChevronRight size={13} />
            </span>

            <span className="sql-head-title">
              <span className="sql-head-name">
                <span className="sql-step mono">{group.badge}</span>
                {group.label}
              </span>
              <span className="sql-head-blurb">{group.focus}</span>
            </span>

            <span className="sql-meter">
              <span className="sql-frac mono">
                {group.solved}/{group.total}
              </span>
              <span className="bar">
                <span style={{ width: `${pct}%` }} />
              </span>
              <span className="pct mono">{pct}%</span>
            </span>
          </span>
        </button>
      </h2>

      {open && (
        <div className="tablewrap">
          <table className="problems sql-table-rows" style={{ minWidth }}>
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
                <SqlProblemRow
                  key={problem._id}
                  problem={problem}
                  index={i}
                  columns={columns}
                  onOpen={onOpen}
                  categoryLabel={categoryLabel}
                />
              ))}
              {group.problems.length === 0 && (
                <tr>
                  <td colSpan={columns.length} style={{ padding: '18px 14px', color: 'var(--text-3)' }}>
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
