import { memo } from 'react';

/**
 * A result set, drawn.
 *
 * One component for all three grids on the page — the sample tables, the
 * expected output, and what your query actually returned — because they are the
 * same object and drawing them differently would suggest they are not. What
 * differs is a `tone`, which is a border colour and a caption, and the diff
 * marks the result grid gets on a fail.
 *
 * `NULL` is spelled out rather than left blank, everywhere. An empty cell reads
 * as "we did not bother filling this in", which is the one thing NULL never
 * means — and this is a module whose whole first lesson is that NULL is a value
 * you have to see.
 */

const show = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (v === '') return "''";
  return String(v);
};

const cellClass = (v) => {
  if (v === null || v === undefined) return 'sql-null';
  if (typeof v === 'number') return 'sql-num';
  return '';
};

/**
 * @param columns  string[]
 * @param rows     any[][]
 * @param caption  what this grid is
 * @param tone     'data' | 'expected' | 'result'
 * @param marks    [{ row, col }] cells that differ — only meaningful on a result
 * @param note     a line under the caption, e.g. "12 of 40 rows"
 */
export const SqlResultGrid = memo(function SqlResultGrid({
  columns = [],
  rows = [],
  caption = '',
  tone = 'data',
  marks = [],
  note = '',
}) {
  const marked = new Set(marks.map((m) => `${m.row}:${m.col}`));

  return (
    <div className={`sql-grid tone-${tone}`}>
      {caption && (
        <div className="sql-grid-head">
          <span className="sql-grid-name mono">{caption}</span>
          {note && <span className="sql-grid-note mono">{note}</span>}
        </div>
      )}

      <div className="sql-grid-scroll">
        <table className="sql-table">
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={`${c}-${i}`} className="mono">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className={`mono ${cellClass(cell)} ${marked.has(`${r}:${c}`) ? 'sql-diff' : ''}`}
                  >
                    {show(cell)}
                  </td>
                ))}
              </tr>
            ))}

            {/*
              An empty result is a real answer — a filter that matched nothing,
              or a DELETE that removed everything — so it says so rather than
              rendering as a header with nothing under it, which looks like a
              component that failed to load.
            */}
            {rows.length === 0 && (
              <tr>
                <td className="sql-grid-empty" colSpan={Math.max(1, columns.length)}>
                  no rows
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});
