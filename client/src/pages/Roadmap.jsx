import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiltersModal } from '../components/filters/FiltersModal.jsx';
import { ColumnsModal } from '../components/problem/ColumnsModal.jsx';
import { GuideReader } from '../components/problem/GuideReader.jsx';
import { PatternSection } from '../components/problem/PatternSection.jsx';
import {
  IconChevronsDown,
  IconChevronsUp,
  IconClose,
  IconCheckSquare,
  IconColumns,
  IconDice,
  IconFilter,
} from '../components/ui/Icons.jsx';
import { isAnyModalOpen } from '../components/ui/Modal.jsx';
import { PageSearch } from '../components/ui/PageSearch.jsx';
import { ROADMAP_FILTERS, SHEETS } from '../filters/roadmap.js';
import { activeCount, clearPatch, matchesFilters } from '../filters/spec.js';
import { useLocalState } from '../hooks/useLocalState.js';
import { useSavedFilters } from '../hooks/useSavedFilters.js';
import { useTableLayout } from '../hooks/useTableLayout.js';
import { useAuth } from '../store/AuthContext.jsx';
import { moduleVisible } from '../store/modules.js';
import { useRoadmap } from '../store/RoadmapContext.jsx';
import { useToast } from '../store/ToastContext.jsx';
import { MotivationLine } from '../components/ui/MotivationLine.jsx';

// What you can narrow by, and what each one means, lives in filters/roadmap.js.
// This page renders it and matches rows with it; it does not enumerate it.

export function Roadmap() {
  const { groups: baseGroups, extraGroups, loadExtras, loading, loadError, setProgress, reload } =
    useRoadmap();
  const { toast } = useToast();
  const { modules } = useAuth();
  // Cosmetic, like every module check in the client — the route is not declared
  // and the API 404s when the module is off.
  const hasPractice = moduleVisible(modules, 'practice');
  /* The roadmap's own search — see `PageSearch`. */
  const [query, setQuery] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  /*
    One bag rather than a `useState` per filter, and saved to the account rather
    than to this tab. Coming back to a roadmap you left narrowed to Hard graph
    problems is the point: a filter set is how you decided to work this week, not
    a thing you re-pick every morning.

    The search box is deliberately not in here. It is a question you ask and get
    an answer to, and restoring last night's into an input you did not type in
    would read as the page ignoring you.
  */
  const [filters, setFilters] = useSavedFilters('roadmap', ROADMAP_FILTERS);
  const patch = useCallback(
    (values) => setFilters((prev) => ({ ...prev, ...values })),
    [setFilters],
  );

  const { flagged, revision, mine } = filters;


  const [openSections, setOpenSections] = useLocalState('open-sections', []);
  /*
    Rows under sub-pattern headings — the tree inside each pattern — or the flat
    easy-to-hard ramp. A way of drawing the page rather than a filter, so it
    lives in this browser beside the open sections, not in the saved filters.
  */
  const [bySub, setBySub] = useLocalState('roadmap-by-subpattern', true);
  /*
    The patterns you have closed *while a filter is on*, which is a different
    question from which patterns are open normally.

    A filter opens every matching pattern, because a filtered view whose matches
    are all behind closed headers has answered nothing. That default is right;
    it was the implementation that was wrong — `isFiltering || openSections
    .includes(slug)` made it a lock rather than a default, so `toggleSection`
    went on writing to `openSections` while `isOpen` ignored it and the header
    was a control that visibly did nothing.

    Kept separate rather than seeded into `openSections`, so clearing the filter
    returns the page to exactly the shape it had before. Seeding would leave all
    twenty-three patterns open the moment the filter came off — and it is not
    persisted, because "I collapsed graphs while looking at one sheet" is not a
    preference worth surviving a reload.
  */
  const [closedWhileFiltering, setClosedWhileFiltering] = useState([]);
  const [cursorId, setCursorId] = useState(null);
  const [openNotesId, setOpenNotesId] = useState(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  /*
    The Kit 360 sheet is the one list whose problems are mostly off the default
    roadmap (`extra` rows). Picking it, or opening the filter dialog (so the
    sheet counts are complete), loads them once and merges them into their
    pattern sections. Nothing else on the page, and no count outside this
    view, ever sees them.
  */
  const wantsExtras = filters.sheet.includes('kit-360');
  useEffect(() => {
    if (wantsExtras || filtersOpen) loadExtras();
  }, [wantsExtras, filtersOpen, loadExtras]);

  const groups = useMemo(() => {
    if (!wantsExtras || !extraGroups?.length) return baseGroups;
    const extraBySlug = new Map(extraGroups.map((g) => [g.slug, g]));
    const merged = baseGroups.map((g) => {
      const extra = extraBySlug.get(g.slug);
      return extra
        ? {
            ...g,
            problems: [...g.problems, ...extra.problems],
            total: (g.total || 0) + (extra.total || 0),
            solved: (g.solved || 0) + (extra.solved || 0),
          }
        : g;
    });
    const known = new Set(baseGroups.map((g) => g.slug));
    return [...merged, ...extraGroups.filter((g) => !known.has(g.slug))];
  }, [baseGroups, extraGroups, wantsExtras]);
  // One reader for the page, not one per section.
  const [guidePattern, setGuidePattern] = useState(null);
  // { id, seq } rather than a bare id: picking the same problem twice has to
  // replay the flash, and a repeated id would not re-run the effect.
  const [pick, setPick] = useState(null);
  const pickSeq = useRef(0);
  const lastPickRef = useRef(null);
  const { layout, setLayout, columns } = useTableLayout();
  const sectionRefs = useRef({});

  /*
    Each problem gets its sub-pattern's display name (the column and the search
    read it), and, grouped, the rows are stably sorted by the pattern's
    sub-pattern order — so each run keeps its easy-to-hard ramp. Unfiled rows
    (your own additions) go last, under "Other".
  */
  const ordered = useMemo(
    () =>
      groups.map((g) => {
        const rank = new Map((g.subPatterns || []).map((s, i) => [s.slug, i]));
        const names = new Map((g.subPatterns || []).map((s) => [s.slug, s.name]));
        const problems = g.problems.map((p) => ({
          ...p,
          subPatternName: names.get(p.subPattern) || '',
        }));
        if (bySub) {
          const at = (p) => rank.get(p.subPattern) ?? Number.MAX_SAFE_INTEGER;
          problems.sort((a, b) => at(a) - at(b));
        }
        return { ...g, problems };
      }),
    [groups, bySub],
  );

  const ownedCount = useMemo(
    () => groups.reduce((n, g) => n + g.problems.filter((p) => p.mine).length, 0),
    [groups],
  );

  /*
    The two lists the dialog offers, taken from the roadmap actually loaded
    rather than from a constant. A company nobody has been asked by and a tag
    nothing carries are options that can only ever return nothing.
  */
  const options = useMemo(() => {
    const companies = new Set();
    const topics = new Set();
    // Its own set, not merged into `companies`: the recency filter offers names
    // that have no frequency data at all, and the frequency filter offers names
    // nobody reported this year. Sharing one list would give each filter options
    // that can only ever return nothing.
    const askedRecently = new Set();
    for (const g of groups) {
      for (const p of g.problems) {
        for (const c of p.companies || []) companies.add(c.name);
        for (const t of p.topicTags || []) topics.add(t);
        for (const name of p.askedRecently || []) askedRecently.add(name);
      }
    }
    // Each sheet's real size in Ember, counting the extras when they are loaded.
    const sheetCounts = new Map();
    for (const g of [...baseGroups, ...(extraGroups || [])]) {
      for (const p of g.problems) {
        for (const s of p.sheets || []) sheetCounts.set(s.sheet, (sheetCounts.get(s.sheet) || 0) + 1);
      }
    }
    const sheet = SHEETS.map((s) => {
      const n = sheetCounts.get(s.value) || 0;
      const gap = s.listed && n < s.listed ? ` of ${s.listed}` : '';
      return { value: s.value, label: s.label, note: `${n}${gap} problems · ${s.desc}` };
    });

    /*
      Only sub-patterns something is filed under, labelled with their pattern:
      "Min Stack" is in two lists, and typing a pattern's name in the menu's
      search should bring up its whole list.
    */
    const subPattern = [];
    for (const g of groups) {
      const counts = new Map();
      for (const p of g.problems) if (p.subPattern) counts.set(p.subPattern, (counts.get(p.subPattern) || 0) + 1);
      for (const s of g.subPatterns || []) {
        const n = counts.get(s.slug);
        if (n) subPattern.push({ value: `${g.slug}/${s.slug}`, label: `${g.name} › ${s.name}`, note: `${n} problem${n === 1 ? '' : 's'}` });
      }
    }

    return {
      subPattern,
      companies: [...companies].sort(),
      topics: [...topics].sort(),
      askedRecently: [...askedRecently].sort(),
      sheet,
    };
  }, [groups, baseGroups, extraGroups]);

  const narrowingCount = activeCount(ROADMAP_FILTERS, filters, 'dialog');
  const filterCount = activeCount(ROADMAP_FILTERS, filters);
  const isFiltering = Boolean(query.trim()) || filterCount > 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return ordered.map((g) => {
      if (!isFiltering) return g;
      const problems = g.problems.filter((p) => {
        if (!matchesFilters(ROADMAP_FILTERS, filters, p)) return false;
        if (q) {
          const haystack = [
            p.title,
            p.subPatternName,
            ...(p.topicTags || []),
            ...(p.companies || []).map((c) => c.name),
            // Typing "Anthropic" has to find something. Those names exist only
            // here, so without this line the search box is blind to eleven of
            // the companies the roadmap now knows about.
            ...(p.askedRecently || []),
          ]
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      });
      return { ...g, problems };
    });
  }, [ordered, query, filters, isFiltering]);

  const visible = useMemo(() => filtered.filter((g) => g.problems.length > 0), [filtered]);

  const isOpen = useCallback(
    (slug) =>
      isFiltering ? !closedWhileFiltering.includes(slug) : openSections.includes(slug),
    [isFiltering, closedWhileFiltering, openSections],
  );

  const toggleSection = (slug) => {
    const flip = (prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug];
    // While filtering, the list being edited is the exceptions to "all open";
    // otherwise it is the open set itself. Two lists, one gesture.
    if (isFiltering) setClosedWhileFiltering(flip);
    else setOpenSections(flip);
  };

  /*
    Force one section open, in whichever list is live.

    Two callers jump the page to a specific row — the random pick and the
    `?pattern=` deep link the Playbook uses — and both used to write
    `openSections` directly. That was correct only while a filter forced every
    section open. Once sections could be closed under a filter, the pick landed
    on a row that was never rendered and the scroll had nothing to scroll to:
    the toast named a problem you could not see.

    It writes both lists rather than branching on `isFiltering`, and that is the
    intended behaviour rather than a shortcut — a jump is a navigation, not a
    toggle, so the section you were sent to should still be open when the filter
    comes off. Toggling stays sealed inside its own list; only an explicit jump
    crosses over.
  */
  const openSection = useCallback(
    (slug) => {
      // Both return `prev` untouched when there is nothing to do, so a jump to
      // a section that is already open re-renders nothing. Unfiltered, the
      // first line is always that no-op.
      setClosedWhileFiltering((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : prev));
      setOpenSections((prev) => (prev.includes(slug) ? prev : [...prev, slug]));
    },
    [setOpenSections],
  );

  /* A new filter starts from everything open again. Without this, closing a
     pattern under one filter would leave it closed under the next one, which
     reads as the app losing a section. */
  useEffect(() => {
    if (!isFiltering) setClosedWhileFiltering([]);
  }, [isFiltering]);

  /* Empties the dialog's filters and leaves the bar's toggles alone — the X sits
     against the Filters chip, so it should clear what is behind that chip. */
  const clearNarrowing = () => patch(clearPatch(ROADMAP_FILTERS, 'dialog'));

  /*
    Unfiltered, open counts as "every pattern", not "every pattern with matches"
    — the button has to be able to close what it opened after a filter is
    cleared. Filtered, only the patterns actually on screen can be counted:
    there is no header to press for the ones with no matches.
  */
  const allOpen = isFiltering
    ? visible.length > 0 && visible.every((g) => !closedWhileFiltering.includes(g.slug))
    : groups.length > 0 && groups.every((g) => openSections.includes(g.slug));

  const toggleAll = () => {
    if (isFiltering) setClosedWhileFiltering(allOpen ? visible.map((g) => g.slug) : []);
    else setOpenSections(allOpen ? [] : groups.map((g) => g.slug));
  };

  /*
    Where `?pattern=` lands — from the Playbook's today panel, and from anywhere
    else that deep-links a section open.

    It used to be reached two ways: this, and a `focus-pattern` window event the
    sidebar's pattern list dispatched when you were already on the roadmap. That
    list is gone, so the event had no dispatcher left and the listener with it.
  */
  const focusPattern = useCallback(
    (slug) => {
      openSection(slug);
      requestAnimationFrame(() => {
        sectionRefs.current[slug]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    },
    [openSection],
  );

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

    openSection(choice.slug);
    setCursorId(choice.id);
    pickSeq.current += 1;
    setPick({ id: choice.id, seq: pickSeq.current });
    toast(`${choice.title} — ${choice.pattern}`);
  }, [pickable, openSection, toast]);

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

  // The bar's own Clear, next to the "n shown" count: everything narrowing the
  // list right now, the search box included.
  const clearAll = () => {
    setQuery('');
    patch(clearPatch(ROADMAP_FILTERS));
  };

  const shown = visible.reduce((n, g) => n + g.problems.length, 0);
  const totalProblems = groups.reduce((n, g) => n + g.problems.length, 0);

  if (loading) {
    return (
      <div className="roadmap-page">
        <div className="page-head">
          <h1>Roadmap</h1>
          <p>Loading your curriculum...</p>
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div className="skeleton" key={i} />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="roadmap-page">
        <div className="empty">
          <h3>Could not load problems</h3>
          <p>{loadError}</p>
          <button className="btn" style={{ marginTop: 12 }} onClick={reload}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    /*
      The page owns its own canvas rather than sitting inside the shell's
      1500px well — see `.roadmap-page` for what that buys the table.
    */
    <div className="roadmap-page">
      <div className="page-head">
        <h1>Pattern Roadmap</h1>
        <p>
          {bySub
            ? 'Work top to bottom. Each pattern is split into its sub-patterns, and inside each one the problems run easy to hard.'
            : 'Work top to bottom. Inside each pattern the problems run easy to hard — that order is the ramp.'}
        </p>
      </div>

      <MotivationLine surface="roadmap" />

      {/*
        Left to right: what narrows the list, then what it narrowed to. The
        dialog button leads because it is the one that holds five filters
        behind it; Expand all and Columns are shelved on the right because they
        change how the roadmap is drawn, not what is in it.
      */}
      <div className="filterbar">
        <PageSearch
          value={query}
          onChange={setQuery}
          count={shown}
          label="Search the roadmap"
          placeholder="Search problems, companies, tags…"
        />

        <button
          className={`toggle-chip ${narrowingCount ? 'on' : ''}`}
          onClick={() => setFiltersOpen(true)}
          title="Difficulty, status, sheet, sub-pattern, topics and companies, and who asked recently"
        >
          <IconFilter size={12} />
          Filters
          {narrowingCount > 0 && <span className="mono">{narrowingCount}</span>}
        </button>

        {/* Against the chip it empties, so the pair reads as one control. Only
            here when there is something to clear — an X that does nothing is
            worse than no X. */}
        {narrowingCount > 0 && (
          <button
            className="chip-clear"
            onClick={clearNarrowing}
            title={`Clear ${narrowingCount === 1 ? 'this filter' : `all ${narrowingCount} filters`}`}
            aria-label="Clear filters"
          >
            <IconClose size={12} />
          </button>
        )}

        {/* The three bar filters. Same saved bag as the dialog's — see
            filters/roadmap.js, where `place: 'bar'` is the only thing that puts
            them out here rather than behind the button. */}
        <button
          className={`toggle-chip ${flagged ? 'on' : ''}`}
          onClick={() => patch({ flagged: !flagged })}
        >
          Flagged
        </button>
        <button
          className={`toggle-chip ${revision ? 'on' : ''}`}
          onClick={() => patch({ revision: !revision })}
        >
          Needs revision
        </button>
        {/* Only offered once there is something to see. On an account that has
            never added a problem this chip filters to an empty roadmap, which
            reads as a bug rather than as an answer. */}
        {ownedCount > 0 && (
          <button
            className={`toggle-chip ${mine ? 'on' : ''}`}
            onClick={() => patch({ mine: !mine })}
            title="Only the problems you added yourself"
          >
            Added by me
            <span className="mono">{ownedCount}</span>
          </button>
        )}

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

        {/*
          The drill, from the page its questions come from. Two clicks from here
          rather than a trip through the side menu, because the moment you want
          it is the moment you are looking at this list and cannot remember what
          half of it is. Hidden with its module, like every other nav route.
        */}
        {hasPractice && (
          <Link
            to="/practice"
            className="toggle-chip"
            title="Drill pattern recognition — title only, six choices"
          >
            <IconCheckSquare size={13} />
            Drill
          </Link>
        )}

        {isFiltering && (
          <>
            <span className="hint mono">{shown} shown</span>
            <button className="link-btn" onClick={clearAll}>
              Clear
            </button>
          </>
        )}

        <span className="spacer" />

        {/* The label always states what the click does, so the icon never has
            to carry the current state on its own. */}
        <button
          className="toggle-chip"
          onClick={toggleAll}
          title={
            allOpen
              ? `Close every ${isFiltering ? 'matching ' : ''}pattern`
              : `Open all ${isFiltering ? visible.length : groups.length} patterns`
          }
        >
          {allOpen ? <IconChevronsUp size={12} /> : <IconChevronsDown size={12} />}
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>

        <button
          className={`toggle-chip ${bySub ? 'on' : ''}`}
          onClick={() => setBySub((v) => !v)}
          aria-pressed={bySub}
          title={
            bySub
              ? 'Showing rows under sub-pattern headings — click for one easy-to-hard list per pattern'
              : 'Group each pattern\'s rows under its sub-patterns'
          }
        >
          Sub-patterns
        </button>

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
          <button className="btn" style={{ marginTop: 12 }} onClick={clearAll}>
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
            grouped={bySub}
          />
          );
        })
      )}

      {filtersOpen && (
        <FiltersModal
          spec={ROADMAP_FILTERS}
          value={filters}
          options={options}
          shown={shown}
          total={totalProblems}
          onChange={patch}
          onClose={() => setFiltersOpen(false)}
        />
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
    </div>
  );
}
