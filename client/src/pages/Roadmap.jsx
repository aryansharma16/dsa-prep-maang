import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { ColumnsModal } from '../components/problem/ColumnsModal.jsx';
import { GuideReader } from '../components/problem/GuideReader.jsx';
import { PatternSection } from '../components/problem/PatternSection.jsx';
import { IconColumns, IconDice } from '../components/ui/Icons.jsx';
import { isAnyModalOpen } from '../components/ui/Modal.jsx';
import { useLocalState } from '../hooks/useLocalState.js';
import { useTableLayout } from '../hooks/useTableLayout.js';
import { useRoadmap } from '../store/RoadmapContext.jsx';
import { useToast } from '../store/ToastContext.jsx';
import { MotivationLine } from '../components/ui/MotivationLine.jsx';

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const SHEETS = [
  ['striver-sde', "Striver's SDE Sheet"],
  ['neetcode-150', 'NeetCode 150'],
  ['blind-75', 'Blind 75'],
];
const STATUSES = [
  ['todo', 'Not started'],
  ['attempted', 'Attempted'],
  ['solved', 'Solved'],
];

export function Roadmap() {
  const { groups, loading, loadError, setProgress, reload } = useRoadmap();
  const { toast } = useToast();
  const { query, setQuery } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();

  const [difficulty, setDifficulty] = useState('');
  const [company, setCompany] = useState('');
  const [sheet, setSheet] = useState('');
  const [status, setStatus] = useState('');
  const [flagged, setFlagged] = useState(false);
  const [revision, setRevision] = useState(false);

  const [openSections, setOpenSections] = useLocalState('open-sections', []);
  const [cursorId, setCursorId] = useState(null);
  const [openNotesId, setOpenNotesId] = useState(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  // One reader for the page, not one per section.
  const [guidePattern, setGuidePattern] = useState(null);
  // { id, seq } rather than a bare id: picking the same problem twice has to
  // replay the flash, and a repeated id would not re-run the effect.
  const [pick, setPick] = useState(null);
  const pickSeq = useRef(0);
  const lastPickRef = useRef(null);
  const { layout, setLayout, columns } = useTableLayout();
  const sectionRefs = useRef({});

  const companyOptions = useMemo(() => {
    const set = new Set();
    for (const g of groups) for (const p of g.problems) for (const c of p.companies || []) set.add(c.name);
    return [...set].sort();
  }, [groups]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const active = q || difficulty || company || sheet || status || flagged || revision;

    return groups.map((g) => {
      if (!active) return g;
      const problems = g.problems.filter((p) => {
        const prog = p.progress || {};
        if (difficulty && p.difficulty !== difficulty) return false;
        if (company && !(p.companies || []).some((c) => c.name === company)) return false;
        if (sheet && !(p.sheets || []).some((s) => s.sheet === sheet)) return false;
        if (status && (prog.status || 'todo') !== status) return false;
        if (flagged && !prog.flagged) return false;
        if (revision && !prog.needsRevision) return false;
        if (q) {
          const haystack = [
            p.title,
            ...(p.topicTags || []),
            ...(p.companies || []).map((c) => c.name),
          ]
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      });
      return { ...g, problems };
    });
  }, [groups, query, difficulty, company, sheet, status, flagged, revision]);

  const visible = useMemo(() => filtered.filter((g) => g.problems.length > 0), [filtered]);

  const isFiltering =
    Boolean(query.trim()) || difficulty || company || sheet || status || flagged || revision;

  const isOpen = useCallback(
    (slug) => isFiltering || openSections.includes(slug),
    [isFiltering, openSections],
  );

  const toggleSection = (slug) =>
    setOpenSections((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );

  // Sidebar clicks and ?pattern= both land here.
  const focusPattern = useCallback(
    (slug) => {
      setOpenSections((prev) => (prev.includes(slug) ? prev : [...prev, slug]));
      requestAnimationFrame(() => {
        sectionRefs.current[slug]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    },
    [setOpenSections],
  );

  useEffect(() => {
    const handler = (e) => focusPattern(e.detail);
    window.addEventListener('focus-pattern', handler);
    return () => window.removeEventListener('focus-pattern', handler);
  }, [focusPattern]);

  useEffect(() => {
    const slug = searchParams.get('pattern');
    if (slug && groups.length) {
      focusPattern(slug);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, groups.length, focusPattern, setSearchParams]);

  // Flat list of what's on screen, so j/k can walk across pattern boundaries.
  const flatRows = useMemo(
    () => visible.filter((g) => isOpen(g.slug)).flatMap((g) => g.problems),
    [visible, isOpen],
  );

  /*
    What "pick one" draws from: everything still worth your time — not solved
    yet, or solved but flagged, or due for revision. It reads the filtered
    groups rather than the raw roadmap, so a pick honours the view you set up
    instead of pulling something from a pattern you deliberately filtered out.
  */
  const pickable = useMemo(
    () =>
      filtered.flatMap((g) =>
        g.problems
          .filter((p) => {
            const prog = p.progress || {};
            return (prog.status || 'todo') !== 'solved' || prog.flagged || prog.needsRevision;
          })
          .map((p) => ({ id: p._id, title: p.title, slug: g.slug, pattern: g.name })),
      ),
    [filtered],
  );

  const pickRandom = useCallback(() => {
    if (!pickable.length) {
      toast('Nothing to pick — everything in this view is solved and clear.');
      return;
    }
    // Landing on the same problem twice in a row reads as a broken button, so
    // the previous pick sits out — unless it is the only thing left.
    const pool =
      pickable.length > 1 ? pickable.filter((p) => p.id !== lastPickRef.current) : pickable;
    const choice = pool[Math.floor(Math.random() * pool.length)];
    lastPickRef.current = choice.id;

    setOpenSections((prev) => (prev.includes(choice.slug) ? prev : [...prev, choice.slug]));
    setCursorId(choice.id);
    pickSeq.current += 1;
    setPick({ id: choice.id, seq: pickSeq.current });
    toast(`${choice.title} — ${choice.pattern}`);
  }, [pickable, setOpenSections, toast]);

  /*
    The row cannot be scrolled to inside the click handler: its section may have
    been collapsed a moment ago, so the <tr> only exists after the commit that
    opened it. Waiting for the picked id to reach the DOM here covers both cases.
    Clearing it afterwards ends the flash and re-arms it for the next pick.
  */
  useEffect(() => {
    if (!pick) return undefined;
    document
      .querySelector(`[data-row="${pick.id}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = setTimeout(() => setPick(null), 1600);
    return () => clearTimeout(timer);
  }, [pick]);

  useEffect(() => {
    const onKey = (e) => {
      if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName) || e.target.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // A dialog is open — "s" belongs to it, not to the row behind it.
      if (isAnyModalOpen()) return;

      const key = e.key.toLowerCase();
      const idx = flatRows.findIndex((p) => p._id === cursorId);
      const current = idx >= 0 ? flatRows[idx] : null;

      if (key === 'j' || key === 'k') {
        e.preventDefault();
        if (!flatRows.length) return;
        const next = key === 'j' ? Math.min(idx + 1, flatRows.length - 1) : Math.max(idx - 1, 0);
        const target = flatRows[idx < 0 ? 0 : next];
        setCursorId(target._id);
        document
          .querySelector(`[data-row="${target._id}"]`)
          ?.scrollIntoView({ block: 'nearest' });
        return;
      }

      // Deliberately before the cursor check — picking is how you get a cursor
      // in the first place.
      if (key === 'p') {
        e.preventDefault();
        pickRandom();
        return;
      }

      if (!current) return;
      const prog = current.progress || {};

      if (key === 's') {
        e.preventDefault();
        setProgress(current._id, { status: prog.status === 'solved' ? 'todo' : 'solved' });
      } else if (key === 'f') {
        e.preventDefault();
        setProgress(current._id, { flagged: !prog.flagged });
      } else if (key === 'r') {
        e.preventDefault();
        setProgress(current._id, { needsRevision: !prog.needsRevision });
      } else if (key === 'n') {
        e.preventDefault();
        setOpenNotesId((id) => (id === current._id ? null : current._id));
      } else if (key === 'o') {
        e.preventDefault();
        window.open(current.url || current.articleUrl, '_blank', 'noreferrer');
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flatRows, cursorId, setProgress, pickRandom]);

  const clearFilters = () => {
    setQuery('');
    setDifficulty('');
    setCompany('');
    setSheet('');
    setStatus('');
    setFlagged(false);
    setRevision(false);
  };

  const shown = visible.reduce((n, g) => n + g.problems.length, 0);

  if (loading) {
    return (
      <>
        <div className="page-head">
          <h1>Roadmap</h1>
          <p>Loading your curriculum...</p>
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div className="skeleton" key={i} />
        ))}
      </>
    );
  }

  if (loadError) {
    return (
      <div className="empty">
        <h3>Could not load problems</h3>
        <p>{loadError}</p>
        <button className="btn" style={{ marginTop: 12 }} onClick={reload}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <h1>Pattern Roadmap</h1>
        <p>
          Work top to bottom. Inside each pattern the problems run easy to hard — that order is the
          ramp.
        </p>
      </div>

      <MotivationLine surface="roadmap" />

      <div className="filterbar">
        <select
          className={`select ${difficulty ? 'on' : ''}`}
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
        >
          <option value="">All difficulty</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <select
          className={`select ${company ? 'on' : ''}`}
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        >
          <option value="">All companies</option>
          {companyOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          className={`select ${sheet ? 'on' : ''}`}
          value={sheet}
          onChange={(e) => setSheet(e.target.value)}
        >
          <option value="">All sheets</option>
          {SHEETS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          className={`select ${status ? 'on' : ''}`}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Any status</option>
          {STATUSES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <button
          className={`toggle-chip ${flagged ? 'on' : ''}`}
          onClick={() => setFlagged((v) => !v)}
        >
          Flagged
        </button>
        <button
          className={`toggle-chip ${revision ? 'on' : ''}`}
          onClick={() => setRevision((v) => !v)}
        >
          Needs revision
        </button>

        <button
          className="toggle-chip pick-btn"
          onClick={pickRandom}
          disabled={!pickable.length}
          title={
            pickable.length
              ? `Jump to a random problem you have not finished with (${pickable.length} in play)`
              : 'Nothing left to pick in this view'
          }
        >
          <IconDice size={13} />
          Pick one
        </button>

        {isFiltering && (
          <>
            <span className="hint mono">{shown} shown</span>
            <button className="link-btn" onClick={clearFilters}>
              Clear
            </button>
          </>
        )}

        <span className="spacer" />
        <button className="toggle-chip" onClick={() => setColumnsOpen(true)} title="Choose columns">
          <IconColumns size={12} />
          Columns
          <span className="mono dim">{columns.length}</span>
        </button>
        <span className="hint">
          <kbd className="mono">j</kbd> <kbd className="mono">k</kbd> move ·{' '}
          <kbd className="mono">s</kbd> solve · <kbd className="mono">f</kbd> flag ·{' '}
          <kbd className="mono">r</kbd> revise · <kbd className="mono">n</kbd> notes ·{' '}
          <kbd className="mono">p</kbd> pick
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="empty">
          <h3>Nothing matches</h3>
          <p>Try clearing a filter or searching for something else.</p>
          <button className="btn" style={{ marginTop: 12 }} onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      ) : (
        visible.map((group) => {
          // Position in the full roadmap, not in the filtered view — the step
          // number has to stay put when a filter hides the patterns above it.
          const index = groups.findIndex((g) => g.slug === group.slug);
          return (
          <PatternSection
            key={group.slug}
            ref={(el) => {
              sectionRefs.current[group.slug] = el;
            }}
            group={group}
            index={index}
            columns={columns}
            open={isOpen(group.slug)}
            onToggle={() => toggleSection(group.slug)}
            onOpenGuide={() => setGuidePattern({ ...group, index })}
            cursorId={cursorId}
            pickedId={pick?.id}
            onFocusRow={setCursorId}
            openNotesId={openNotesId}
            onToggleNotes={(id) => setOpenNotesId((cur) => (cur === id ? null : id))}
          />
          );
        })
      )}

      {columnsOpen && (
        <ColumnsModal
          layout={layout}
          onSave={setLayout}
          onClose={() => setColumnsOpen(false)}
        />
      )}

      {guidePattern && (
        <GuideReader pattern={guidePattern} onClose={() => setGuidePattern(null)} />
      )}
    </>
  );
}
