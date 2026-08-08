import { forwardRef } from 'react';
import { IconChevronRight } from '../ui/Icons.jsx';
import { ProblemRow } from './ProblemRow.jsx';

export const PatternSection = forwardRef(function PatternSection(
  { group, index, open, onToggle, cursorId, onFocusRow, openNotesId, onToggleNotes },
  ref,
) {
  const pct = group.total ? Math.round((group.solved / group.total) * 100) : 0;

  return (
    <section className="pattern" ref={ref} id={`pattern-${group.slug}`}>
      {/*
        The technique chips live inside the header button, not after it. Kept
        outside, the hover highlight stopped above them and the chips read as
        colliding with the heading. All spans, so this stays valid inside a
        button.
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
      </h2>

      {open && (
        <>
          <div className="tablewrap">
            <table className="problems">
              <thead>
                <tr>
                  <th className="col-status" />
                  <th className="col-num">#</th>
                  <th>Problem</th>
                  <th className="col-diff">Difficulty</th>
                  <th className="col-cos">Asked at</th>
                  <th className="col-acts">Track</th>
                </tr>
              </thead>
              <tbody>
                {group.problems.map((problem, i) => (
                  <ProblemRow
                    key={problem._id}
                    problem={problem}
                    index={i}
                    isCursor={cursorId === problem._id}
                    onFocus={() => onFocusRow(problem._id)}
                    notesOpen={openNotesId === problem._id}
                    onToggleNotes={() => onToggleNotes(problem._id)}
                  />
                ))}
                {group.problems.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '18px 14px', color: 'var(--text-3)' }}>
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
