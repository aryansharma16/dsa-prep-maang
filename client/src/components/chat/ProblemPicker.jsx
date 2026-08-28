import { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '../../store/ChatContext.jsx';
import { useRoadmap } from '../../store/RoadmapContext.jsx';
import { readCPLadder } from '../../store/cpLadderCache.js';
import { ratingColour } from '../../theme/cfRating.js';
import { IconClose, IconSearch } from '../ui/Icons.jsx';

/**
 * Attach a problem, from what is already in memory.
 *
 * `RoadmapContext` is mounted for every signed-in route, so the whole roadmap
 * is a local array — this picker makes no request at all. The filter is the one
 * Roadmap.jsx uses, so a search that finds a problem on the table finds it here.
 *
 * A sheet inside the panel rather than a Modal: a full-viewport dimmed overlay
 * over a 350px widget is heavier than the thing it is covering, and this way
 * one component works in the dock and on the full page.
 */

export function ProblemPicker({ onPick, onClose }) {
  const { groups } = useRoadmap();
  /*
    Which curriculum to offer, from the same route-derived mode the assistant
    itself uses. On /cp the coach's context builder reads the CP collection, so
    handing it a roadmap problem id would attach nothing at all.
  */
  const { mode } = useChat();
  const isCp = mode === 'cp';
  const [q, setQ] = useState('');
  const inputRef = useRef(null);
  const sheetRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onDown = (e) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  /*
    Every match, grouped by pattern — no cap.

    An earlier version stopped at forty rows, which with an empty search meant
    the list ended partway through the second pattern and looked like the
    roadmap only had two. A truncated list that does not say it is truncated is
    worse than a long one: you cannot tell a missing problem from a missing
    feature. Four hundred-odd buttons is nothing for React, the search narrows
    it instantly, and the group headings make scrolling navigable.
  */
  const { sections, count } = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = [];
    let total = 0;

    /*
      The CP ladder, grouped by tier. Read at open time from the module cache
      rather than from a context, because the dock is mounted in the app shell
      beside the /cp route and not inside its provider — see cpLadderCache.js.
    */
    const source = isCp
      ? Object.values(
          readCPLadder().reduce((acc, p) => {
            acc[p.tier] ??= { slug: p.tier, name: p.tierLabel || p.tier, problems: [] };
            acc[p.tier].problems.push(p);
            return acc;
          }, {}),
        )
      : groups;

    for (const group of source) {
      const matches = needle
        ? group.problems.filter((problem) =>
            [
              problem.title,
              group.name,
              // "1352G" is how a CP problem is actually named in conversation,
              // and "1400" is how its difficulty is.
              problem.code || '',
              problem.rating ? String(problem.rating) : '',
              ...(problem.topicTags || []),
              ...(problem.companies || []).map((c) => c.name),
            ]
              .join(' ')
              .toLowerCase()
              .includes(needle),
          )
        : group.problems;

      if (!matches.length) continue;
      total += matches.length;
      out.push({ slug: group.slug, name: group.name, problems: matches });
    }

    return { sections: out, count: total };
  }, [groups, q, isCp]);

  return (
    <div className="chat-sheet" ref={sheetRef} role="dialog" aria-label="Attach a problem">
      <div className="chat-sheet-head">
        <span className="glass">
          <IconSearch size={12} />
        </span>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search problems..."
          aria-label="Search problems"
        />
        <span className="chat-pick-count mono">{count}</span>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <IconClose size={13} />
        </button>
      </div>

      <div className="chat-pick">
        {count === 0 && (
          <div className="empty">
            {isCp && !q.trim()
              ? 'The ladder is not loaded yet. Open Pro Coder, then try again.'
              : 'No problem matches that.'}
          </div>
        )}

        {sections.map((section) => (
          <div key={section.slug}>
            <div className="chat-pick-head">
              {section.name}
              <span className="count">{section.problems.length}</span>
            </div>
            {section.problems.map((problem) => (
              <button
                key={problem._id}
                type="button"
                className="chat-pick-item"
                onClick={() => onPick({ ...problem, patternName: section.name })}
              >
                {/*
                  Two curricula, two ways of saying "how hard".

                  A roadmap problem wears its E/M/H letter. A ladder problem
                  wears its rating in its Codeforces band colour, because that
                  is the number the person is actually navigating by — and
                  because `difficulty` on a CP row is a free-text platform label
                  that is very often empty. Both branches cope with a missing
                  value rather than indexing into it.
                */}
                {isCp ? (
                  <span className="chat-pick-rating mono" style={{ color: ratingColour(problem.rating) }}>
                    {problem.rating || problem.difficulty || '—'}
                  </span>
                ) : (
                  <span className={`diff ${problem.difficulty || ''}`}>
                    {problem.difficulty?.[0] || '?'}
                  </span>
                )}
                <span className="nm">{problem.title}</span>
                {isCp && problem.code && <span className="chat-pick-group mono">{problem.code}</span>}
                {(problem.progress?.status || problem.status) === 'solved' && (
                  <span className="chat-pick-done">solved</span>
                )}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
