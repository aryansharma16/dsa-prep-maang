import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiltersModal } from '../components/filters/FiltersModal.jsx';
import { ColumnsModal } from '../components/problem/ColumnsModal.jsx';
import { ArenaHeader } from '../components/cp/ArenaHeader.jsx';
import { CPGuideReader } from '../components/cp/CPGuideReader.jsx';
import { CPSection } from '../components/cp/CPSection.jsx';
import {
  CP_COLUMNS,
  CP_COLUMNS_STORAGE_KEY,
  CP_DEFAULT_PINNED,
} from '../components/cp/cpColumns.jsx';
import {
  IconChevronsDown,
  IconChevronsUp,
  IconClose,
  IconColumns,
  IconDice,
  IconFilter,
} from '../components/ui/Icons.jsx';
import { isAnyModalOpen } from '../components/ui/Modal.jsx';
import { PageSearch } from '../components/ui/PageSearch.jsx';
import { CP_FILTERS } from '../filters/cp.js';
import { activeCount, clearPatch, matchesFilters } from '../filters/spec.js';
import { useLocalState } from '../hooks/useLocalState.js';
import { useSavedFilters } from '../hooks/useSavedFilters.js';
import { useTableLayout } from '../hooks/useTableLayout.js';
import { useCP } from '../store/CPContext.jsx';
import { useToast } from '../store/ToastContext.jsx';

/**
 * Pro Coder — the competitive-programming ladder.
 *
 * The page is organised on two axes and lets you pick which one is the spine.
 * **Tier** is the default because that is how competitive programming is
 * actually learned: your rating gates what you can attempt, and a ladder that
 * opened on "Dynamic Programming" would hand a 1200 a section running from 800
 * to 3400. **Pattern** is one toggle away for when you are deliberately drilling
 * a technique across the whole range.
 *
 * Both groupings are derived here from one flat list. That is what makes the
 * toggle instant — the server ships the rows once and this decides how to
 * bundle them, so flipping the spine costs a re-render and not a request.
 */
export function ProCoder() {
  const {
    problems,
    tiers,
    patterns,
    profile,
    totals,
    loading,
    loadError,
    reload,
    setProgress,
  } = useCP();
  const { toast } = useToast();
  /* The ladder's own search — see `PageSearch`. */
  const [query, setQuery] = useState('');

  const [filters, setFilters] = useSavedFilters('cp', CP_FILTERS);
  const patch = useCallback(
    (values) => setFilters((prev) => ({ ...prev, ...values })),
    [setFilters],
  );

  const { platform, flagged, revision, unlogged, mine } = filters;

  const [groupBy, setGroupBy] = useLocalState('cp-group-by', 'tier');
  const [openSections, setOpenSections] = useLocalState('cp-open-sections', []);
  const [cursorId, setCursorId] = useState(null);
  const [openNotesId, setOpenNotesId] = useState(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [guidePattern, setGuidePattern] = useState(null);
  // { id, seq } rather than a bare id: picking the same problem twice has to
  // replay the flash, and a repeated id would not re-run the effect.
  const [pick, setPick] = useState(null);
  const pickSeq = useRef(0);
  const lastPickRef = useRef(null);
  const sectionRefs = useRef({});

  const { layout, setLayout, columns } = useTableLayout({
    registry: CP_COLUMNS,
    storageKey: CP_COLUMNS_STORAGE_KEY,
    defaultPins: CP_DEFAULT_PINNED,
  });

  const tierBySlug = useMemo(() => new Map(tiers.map((t) => [t.slug, t])), [tiers]);
  const patternBySlug = useMemo(() => new Map(patterns.map((p) => [p.slug, p])), [patterns]);
  const tierLabel = useCallback((slug) => tierBySlug.get(slug)?.label || slug, [tierBySlug]);
  const patternName = useCallback((slug) => patternBySlug.get(slug)?.name || slug, [patternBySlug]);

  const ownedCount = useMemo(() => problems.filter((p) => p.mine).length, [problems]);
  const unloggedCount = useMemo(
    () =>
      problems.filter(
        (p) => p.progress?.solvedOnPlatform && (p.progress?.status || 'todo') !== 'solved',
      ).length,
    [problems],
  );

  /*
    The lists the dialog offers, taken from the ladder actually loaded rather
    than from a constant. A tag nothing carries and a contest nothing came from
    are options that can only ever return nothing.
  */
  const options = useMemo(() => {
    const topics = new Set();
    const platformTags = new Set();
    const contests = new Set();
    const companies = new Set();
    for (const p of problems) {
      for (const t of p.topicTags || []) topics.add(t);
      for (const t of p.platformTags || []) platformTags.add(t);
      for (const c of p.companies || []) companies.add(c.name);
      const contest = p.codeforces?.contestName || p.codechef?.contestCode;
      if (contest) contests.add(contest);
    }
    return {
      topics: [...topics].sort(),
      platformTags: [...platformTags].sort(),
      contest: [...contests].sort(),
      companies: [...companies].sort(),
      tier: tiers.map((t) => ({ value: t.slug, label: t.label, note: `${t.min}${t.max ? `–${t.max}` : '+'}` })),
      patterns: patterns.map((p) => ({
        value: p.slug,
        label: p.name,
        note: tierLabel(p.tier),
      })),
    };
  }, [problems, tiers, patterns, tierLabel]);

  const narrowingCount = activeCount(CP_FILTERS, filters, 'dialog');
  const filterCount = activeCount(CP_FILTERS, filters);
  const isFiltering = Boolean(query.trim()) || filterCount > 0;

  const matching = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!isFiltering) return problems;

    return problems.filter((p) => {
      if (!matchesFilters(CP_FILTERS, filters, p)) return false;
      if (q) {
        /*
          The judge's coordinates are searchable alongside the title, because
          "1352G" is how a competitive programmer actually names a problem —
          searching for the words in its title is the unusual case.
        */
        const haystack = [
          p.title,
          p.slug,
          p.codeforces ? `${p.codeforces.contestId}${p.codeforces.index}` : '',
          p.codeforces?.contestName || '',
          p.codechef?.code || '',
          ...(p.topicTags || []),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [problems, query, filters, isFiltering]);

  /**
   * The rows, bundled by whichever spine is on.
   *
   * Groups keep their curriculum order and their *full* totals — the fraction on
   * a section header counts everything in it, not everything that survived the
   * filter, because "8/24 solved" is a fact about the section and would
   * otherwise change every time you typed in the search box.
   */
  const groups = useMemo(() => {
    const source = groupBy === 'tier' ? tiers : patterns;
    const buckets = new Map(source.map((g) => [g.slug, []]));

    for (const p of matching) {
      const key = groupBy === 'tier' ? p.tier : p.patternSlug;
      if (buckets.has(key)) buckets.get(key).push(p);
    }

    return source.map((g, i) => ({
      ...g,
      badge: groupBy === 'tier' ? `T${String(i).padStart(2, '0')}` : String(i + 1).padStart(2, '0'),
      problems: buckets.get(g.slug) || [],
    }));
  }, [matching, groupBy, tiers, patterns]);

  const visible = useMemo(() => groups.filter((g) => g.problems.length > 0), [groups]);

  const isOpen = useCallback(
    (slug) => isFiltering || openSections.includes(slug),
    [isFiltering, openSections],
  );

  const toggleSection = (slug) =>
    setOpenSections((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );

  const clearNarrowing = () => patch(clearPatch(CP_FILTERS, 'dialog'));

  const allOpen = groups.length > 0 && groups.every((g) => openSections.includes(g.slug));
  const toggleAll = () => setOpenSections(allOpen ? [] : groups.map((g) => g.slug));

  const focusSection = useCallback(
    (slug) => {
      setOpenSections((prev) => (prev.includes(slug) ? prev : [...prev, slug]));
      requestAnimationFrame(() => {
        sectionRefs.current[slug]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    },
    [setOpenSections],
  );

  /**
   * Which tier the rail marks as "you".
   *
   * The linked rating if there is one, because that is the truth — Codeforces
   * decides what tier you are, not how far down the list you have scrolled.
   * Without a handle it falls back to the first tier you have not finished,
   * which is the best available guess and visibly a different kind of claim.
   */
  const activeTier = useMemo(() => {
    if (profile?.tier) return profile.tier;
    const unfinished = tiers.find((t) => t.total > 0 && t.solved < t.total);
    return unfinished?.slug || null;
  }, [profile, tiers]);

  const jumpToTier = useCallback(
    (slug) => {
      if (groupBy !== 'tier') {
        // Jumping to a tier from the rail while grouped by pattern would scroll
        // to a section that does not exist. Switch the spine, then scroll.
        setGroupBy('tier');
        requestAnimationFrame(() => focusSection(slug));
        return;
      }
      focusSection(slug);
    },
    [groupBy, setGroupBy, focusSection],
  );

  // Flat list of what is on screen, so j/k can walk across section boundaries.
  const flatRows = useMemo(
    () => visible.filter((g) => isOpen(g.slug)).flatMap((g) => g.problems),
    [visible, isOpen],
  );

  /*
    What "pick one" draws from: everything still worth your time — not solved,
    or solved but flagged, or due for revision. It reads the filtered rows, so a
    pick honours the view you set up.
  */
  const pickable = useMemo(
    () =>
      matching
        .filter((p) => {
          const prog = p.progress || {};
          return (prog.status || 'todo') !== 'solved' || prog.flagged || prog.needsRevision;
        })
        .map((p) => ({
          id: p._id,
          title: p.title,
          slug: groupBy === 'tier' ? p.tier : p.patternSlug,
          group: groupBy === 'tier' ? tierLabel(p.tier) : patternName(p.patternSlug),
          rating: p.codeforces?.rating,
        })),
    [matching, groupBy, tierLabel, patternName],
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
    toast(`${choice.title}${choice.rating ? ` · ${choice.rating}` : ''} — ${choice.group}`);
  }, [pickable, setOpenSections, toast]);

  /*
    The row cannot be scrolled to inside the click handler: its section may have
    been collapsed a moment ago, so the <tr> only exists after the commit that
    opened it. Waiting for the picked id to reach the DOM covers both cases.
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
        document.querySelector(`[data-row="${target._id}"]`)?.scrollIntoView({ block: 'nearest' });
        return;
      }

      // Deliberately before the cursor check — picking is how you get a cursor
      // in the first place.
      if (key === 'p') {
        e.preventDefault();
        pickRandom();
        return;
      }

      if (key === 'g') {
        e.preventDefault();
        setGroupBy((g) => (g === 'tier' ? 'pattern' : 'tier'));
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
        window.open(current.url || current.editorialUrl, '_blank', 'noreferrer');
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flatRows, cursorId, setProgress, pickRandom, setGroupBy]);

  const clearAll = () => {
    setQuery('');
    patch(clearPatch(CP_FILTERS));
  };

  const shown = visible.reduce((n, g) => n + g.problems.length, 0);

  if (loading) {
    return (
      <div className="cp-root cp-page">
        <div className="cp-arena skeleton-arena" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div className="skeleton" key={i} />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="cp-root cp-page">
        <div className="empty">
          <h3>Could not load the ladder</h3>
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
      Everything below lives inside `.cp-root`, and that wrapper is the whole
      theming mechanism: it redefines the token set the rest of the app's
      components already read, so the modals, chips and tables that this page
      reuses re-skin themselves without a second stylesheet. See styles/cp.css.

      `.cp-page` is the geometry — the canvas, its ambient wash, and the rule
      that takes this page out of the shell's 1500px well. Kept separate from
      the tokens because the guide reader wears `.cp-root` on its own overlay
      and wants the palette without a page's padding.
    */
    <div className="cp-root cp-page">
      <ArenaHeader
        tiers={tiers}
        totals={totals}
        activeTier={activeTier}
        onJumpTier={jumpToTier}
      />

      <div className="filterbar cp-bar">
        <PageSearch
          value={query}
          onChange={setQuery}
          count={shown}
          label="Search the ladder"
          placeholder="Search title, 1352G, contest, tag…"
        />

        {/* The spine. Next control on the bar because it decides what
            everything below it means. */}
        <div className="size-group filter-seg cp-spine">
          {['tier', 'pattern'].map((mode) => (
            <button
              key={mode}
              type="button"
              className={groupBy === mode ? 'on' : ''}
              aria-pressed={groupBy === mode}
              onClick={() => setGroupBy(mode)}
              title={
                mode === 'tier'
                  ? 'Group by rating tier — the progression'
                  : 'Group by technique — drill one pattern across every rating'
              }
            >
              {mode === 'tier' ? 'Tier' : 'Pattern'}
            </button>
          ))}
        </div>

        {/* Platform is a bar filter rather than a dialog one because keeping the
            two judges independently filterable is a headline feature, not a
            setting. */}
        <div className="size-group filter-seg">
          {CP_FILTERS.byId.platform.options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={platform === option.value ? 'on' : ''}
              aria-pressed={platform === option.value}
              onClick={() => patch({ platform: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>

        <button
          className={`toggle-chip ${narrowingCount ? 'on' : ''}`}
          onClick={() => setFiltersOpen(true)}
          title="Rating, tier, division, pattern, topics and contest"
        >
          <IconFilter size={12} />
          Filters
          {narrowingCount > 0 && <span className="mono">{narrowingCount}</span>}
        </button>

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

        {/* Only offered once the sync has actually found some. On an account
            with no linked handle this filters to nothing, which reads as a bug
            rather than as an answer. */}
        {unloggedCount > 0 && (
          <button
            className={`toggle-chip ${unlogged ? 'on' : ''}`}
            onClick={() => patch({ unlogged: !unlogged })}
            title="Codeforces says you solved these, but they are not marked here"
          >
            AC not logged
            <span className="mono">{unloggedCount}</span>
          </button>
        )}

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
              ? `Jump to a random unfinished problem (${pickable.length} in play)`
              : 'Nothing left to pick in this view'
          }
        >
          <IconDice size={13} />
          Pick one
        </button>

        {isFiltering && (
          <>
            <span className="hint mono">{shown} shown</span>
            <button className="link-btn" onClick={clearAll}>
              Clear
            </button>
          </>
        )}

        <span className="spacer" />

        <button
          className="toggle-chip"
          onClick={toggleAll}
          disabled={isFiltering}
          title={
            isFiltering
              ? 'While a filter is on, every matching section stays open'
              : allOpen
                ? 'Close every section'
                : 'Open every section'
          }
        >
          {allOpen ? <IconChevronsUp size={12} /> : <IconChevronsDown size={12} />}
          {allOpen ? 'Collapse all' : 'Expand all'}
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
          <kbd className="mono">g</kbd> group · <kbd className="mono">p</kbd> pick
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
        visible.map((group) => (
          <CPSection
            key={group.slug}
            ref={(el) => {
              sectionRefs.current[group.slug] = el;
            }}
            group={group}
            kind={groupBy}
            columns={columns}
            open={isOpen(group.slug)}
            onToggle={() => toggleSection(group.slug)}
            onOpenGuide={() =>
              setGuidePattern({ ...group, tierLabel: tierLabel(group.tier) })
            }
            cursorId={cursorId}
            pickedId={pick?.id}
            onFocusRow={setCursorId}
            openNotesId={openNotesId}
            onToggleNotes={(id) => setOpenNotesId((cur) => (cur === id ? null : id))}
            tierLabel={tierLabel}
            patternName={patternName}
          />
        ))
      )}

      {filtersOpen && (
        <FiltersModal
          spec={CP_FILTERS}
          value={filters}
          options={options}
          shown={shown}
          total={problems.length}
          onChange={patch}
          onClose={() => setFiltersOpen(false)}
          title="Ladder filters"
        />
      )}

      {columnsOpen && (
        <ColumnsModal
          layout={layout}
          registry={CP_COLUMNS}
          defaultPins={CP_DEFAULT_PINNED}
          title="Ladder columns"
          onSave={setLayout}
          onClose={() => setColumnsOpen(false)}
        />
      )}

      {guidePattern && (
        <CPGuideReader pattern={guidePattern} onClose={() => setGuidePattern(null)} />
      )}
    </div>
  );
}
