import { useCallback, useEffect, useMemo, useState } from 'react';
import { ColumnsModal } from '../components/problem/ColumnsModal.jsx';
import { FiltersModal } from '../components/filters/FiltersModal.jsx';
import { SqlSection } from '../components/sql/SqlSection.jsx';
import { SqlWorkbench } from '../components/sql/SqlWorkbench.jsx';
import {
  SQL_COLUMNS,
  SQL_COLUMNS_STORAGE_KEY,
  SQL_DEFAULT_PINNED,
} from '../components/sql/sqlColumns.jsx';
import { SQL_FILTERS } from '../filters/sql.js';
import { activeCount, clearPatch, matchesFilters } from '../filters/spec.js';
import { useLocalState } from '../hooks/useLocalState.js';
import { useSavedFilters } from '../hooks/useSavedFilters.js';
import { useTableLayout } from '../hooks/useTableLayout.js';
import {
  IconChevronsDown,
  IconChevronsUp,
  IconClose,
  IconColumns,
  IconFilter,
} from '../components/ui/Icons.jsx';
import { isAnyModalOpen } from '../components/ui/Modal.jsx';
import { PageSearch } from '../components/ui/PageSearch.jsx';
import { useSql } from '../store/SqlContext.jsx';

/**
 * The SQL Lab.
 *
 * Pro Coder's page, in shape: a rail of group cards across the top, a spine
 * toggle, a filter bar, and collapsible sections of a table. The difference is
 * what a row opens — for most of them, not a link out to a judge but a workbench
 * where the query actually runs.
 *
 * "Most of them", because the bank holds two kinds of row. A problem that
 * already lives on a judge links there instead of being re-hosted here, and
 * `mode` is what says which a row is. The page treats that as a property of the
 * row rather than a second page or a second tab: the categories, the filters,
 * the columns and the progress ladder are the same for both, and only the click
 * differs.
 *
 * `.sql-root` carries the palette and `.sql-page` the geometry, and the split
 * matters for the same reason it does on the ladder: the workbench is a
 * full-viewport overlay that wants the colours without a page's padding.
 */
/**
 * A slug is what the data says; this is what a person reads. `ours` is not a
 * platform at all — it is the absence of one — and spelling it out is the
 * difference between a filter option and a puzzle.
 *
 * At module scope rather than inside the component, so the `useMemo` that reads
 * it is not depending on an object rebuilt on every render.
 */
const SOURCE_LABEL = {
  ours: 'Written for the Lab',
  leetcode: 'LeetCode',
  github: 'Interview question lists',
};

export function SqlLab() {
  const { problems, categories, difficulties, totals, loading, loadError, reload } = useSql();

  /* The Lab's own search, not the shell's. See `PageSearch` for why the one box
     in the top bar became four boxes beside four lists. */
  const [query, setQuery] = useState('');

  const [filters, setFilters] = useSavedFilters('sql', SQL_FILTERS);
  const patch = useCallback(
    (values) => setFilters((prev) => ({ ...prev, ...values })),
    [setFilters],
  );

  const [groupBy, setGroupBy] = useLocalState('sql-group-by', 'category');
  const [openSections, setOpenSections] = useLocalState('sql-open-sections', ['select']);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [open, setOpen] = useState(null);

  const { layout, setLayout, columns } = useTableLayout({
    registry: SQL_COLUMNS,
    storageKey: SQL_COLUMNS_STORAGE_KEY,
    defaultPins: SQL_DEFAULT_PINNED,
  });

  const categoryLabel = useCallback(
    (slug) => categories.find((c) => c.slug === slug)?.label || slug,
    [categories],
  );

  /*
    The workbench is for problems that have something to run. A linked row's
    title is an anchor, so this should never be reached for one — it is here
    because "never reached" is a claim about markup two files away, and the
    failure if it stops being true is a workbench that opens on a problem with
    no schema, no expected grid and a permanently empty editor.
  */
  const openProblem = useCallback((problem) => {
    if (problem.mode === 'external') return;
    setOpen(problem);
  }, []);

  /* ------------------------------------------------------------- filtering */

  const narrowingCount = activeCount(SQL_FILTERS, filters, 'dialog');
  const filterCount = activeCount(SQL_FILTERS, filters);
  const isFiltering = Boolean(query.trim()) || filterCount > 0;

  const matching = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!isFiltering) return problems;

    return problems.filter((p) => {
      if (!matchesFilters(SQL_FILTERS, filters, p)) return false;
      if (!q) return true;
      /* Free text stays hand-rolled per page, deliberately — see spec.js. */
      return (
        p.title.toLowerCase().includes(q) ||
        p.slug.includes(q) ||
        (p.statement || '').toLowerCase().includes(q) ||
        (p.topicTags || []).some((t) => t.includes(q))
      );
    });
  }, [problems, query, filters, isFiltering]);

  /* -------------------------------------------------------------- grouping */

  const groups = useMemo(() => {
    const source = groupBy === 'category' ? categories : difficulties;
    const buckets = new Map(source.map((g) => [g.slug, []]));

    for (const p of matching) {
      const key = groupBy === 'category' ? p.category : p.difficulty;
      if (buckets.has(key)) buckets.get(key).push(p);
    }

    return source.map((g, i) => ({
      ...g,
      badge: groupBy === 'category' ? `C${String(i).padStart(2, '0')}` : String(i + 1).padStart(2, '0'),
      problems: buckets.get(g.slug) || [],
    }));
  }, [matching, groupBy, categories, difficulties]);

  const visible = useMemo(() => groups.filter((g) => g.problems.length > 0), [groups]);

  const isOpen = useCallback(
    (slug) => isFiltering || openSections.includes(slug),
    [isFiltering, openSections],
  );

  const toggleSection = (slug) =>
    setOpenSections((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );

  /*
    One control that states what the click does, rather than two that are each
    right half the time — the same shape the roadmap and the ladder use, and the
    reason `openSections` is read here rather than `isOpen`: `isOpen` reports
    what is *drawn*, which while filtering is everything, and asking it would
    make the button read "Collapse all" over sections that are only open because
    a filter is on.
  */
  const allOpen = groups.length > 0 && groups.every((g) => openSections.includes(g.slug));
  const toggleAll = () => setOpenSections(allOpen ? [] : groups.map((g) => g.slug));

  /* ------------------------------------------------------------- keyboard */

  useEffect(() => {
    const onKey = (e) => {
      if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName) || e.target.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      /* A dialog is open — the key belongs to it, not to the page behind it. */
      if (isAnyModalOpen()) return;
      if (open) return;

      if (e.key === 'g') {
        e.preventDefault();
        setGroupBy((g) => (g === 'category' ? 'difficulty' : 'category'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setGroupBy]);

  /* ------------------------------------------------------- dialog options */

  const options = useMemo(
    () => ({
      category: categories.map((c) => ({ value: c.slug, label: c.label, note: c.focus })),
      topics: [...new Set(problems.flatMap((p) => p.topicTags || []))]
        .sort()
        .map((t) => ({ value: t, label: t })),
      source: [...new Set(problems.map((p) => p.source?.platform || 'ours'))]
        .sort()
        .map((s) => ({ value: s, label: SOURCE_LABEL[s] || s })),
    }),
    [categories, problems],
  );

  /* How the bank splits between the two kinds, for the line under the heading. */
  const counts = useMemo(() => {
    const linked = problems.filter((p) => p.mode === 'external').length;
    return { linked, lab: problems.length - linked };
  }, [problems]);

  /* ---------------------------------------------------------------- render */

  if (loading) {
    return (
      <div className="sql-root sql-page">
        <div className="sql-rail skeleton-rail" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div className="skeleton" key={i} />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="sql-root sql-page">
        <div className="empty">
          <h3>Could not load the bank</h3>
          <p>{loadError}</p>
          <button className="btn" style={{ marginTop: 12 }} onClick={reload}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const shown = matching.length;

  return (
    <div className="sql-root sql-page">
      <header className="sql-arena">
        <div className="sql-brand">
          <span className="sql-brand-mark mono">/SQL</span>
          <div>
            <h1>SQL Lab</h1>
            <p className="mono">
              {totals.solved} OF {totals.total} SOLVED · {counts.lab} RUN IN YOUR BROWSER ·{' '}
              {counts.linked} ON THE PLATFORM
            </p>
          </div>
        </div>

        <div className="sql-rail" role="group" aria-label="Categories">
          {categories.map((c) => {
            const pct = c.total ? Math.round((c.solved / c.total) * 100) : 0;
            return (
              <button
                key={c.slug}
                type="button"
                className="sql-rung"
                data-category={c.slug}
                title={`${c.label} — ${c.focus}`}
                onClick={() => {
                  setGroupBy('category');
                  setOpenSections((prev) => (prev.includes(c.slug) ? prev : [...prev, c.slug]));
                  requestAnimationFrame(() =>
                    document.getElementById(`sql-${c.slug}`)?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    }),
                  );
                }}
              >
                <span className="sql-rung-label">{c.label}</span>
                <span className="sql-rung-bar">
                  <span style={{ width: `${pct}%` }} />
                </span>
                <span className="sql-rung-frac mono">
                  {c.solved}/{c.total}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="filterbar sql-bar">
        <PageSearch
          value={query}
          onChange={setQuery}
          count={shown}
          label="Search the SQL Lab"
          placeholder="Search title, statement, topic…"
        />

        <div className="size-group filter-seg sql-spine">
          {['category', 'difficulty'].map((mode) => (
            <button
              key={mode}
              type="button"
              className={groupBy === mode ? 'on' : ''}
              aria-pressed={groupBy === mode}
              onClick={() => setGroupBy(mode)}
              title={
                mode === 'category'
                  ? 'Group by what the question is about — the curriculum'
                  : 'Group by how hard it is'
              }
            >
              {mode === 'category' ? 'Category' : 'Difficulty'}
            </button>
          ))}
        </div>

        <button
          type="button"
          className={`toggle-chip ${narrowingCount ? 'on' : ''}`}
          onClick={() => setFiltersOpen(true)}
          title="Category, difficulty, status, topics, source, and where you solve it"
        >
          <IconFilter size={12} />
          Filters
          {narrowingCount > 0 && <span className="mono">{narrowingCount}</span>}
        </button>

        {/*
          Against the chip it empties, so the pair reads as one control — that is
          what the negative margin on `.chip-clear` is for, and it only lands if
          this button is the chip's immediate neighbour. It used to sit further
          down the bar next to the "N shown" hint, where the margin pulled it
          into a piece of text instead.

          An icon, not the word "Clear": `.chip-clear` is a 26px square built for
          a 12px glyph, and the word overflowed it — which is why the border
          looked broken rather than absent. The roadmap and the ladder have
          always used the icon here; this was the one bar that did not.

          Shown on `isFiltering` rather than `narrowingCount`, because unlike the
          other two bars this one also clears the search box, and there has to be
          a way to undo a search that is hiding rows.
        */}
        {isFiltering && (
          <button
            type="button"
            className="chip-clear"
            onClick={() => {
              setQuery('');
              patch(clearPatch(SQL_FILTERS));
            }}
            title={
              filterCount
                ? `Clear the search and ${filterCount === 1 ? 'the one filter' : `all ${filterCount} filters`}`
                : 'Clear the search'
            }
            aria-label="Clear filters"
          >
            <IconClose size={12} />
          </button>
        )}

        {SQL_FILTERS.fields
          .filter((f) => f.place === 'bar')
          .map((f) => (
            <button
              key={f.id}
              type="button"
              className={`toggle-chip ${filters[f.id] ? 'on' : ''}`}
              aria-pressed={Boolean(filters[f.id])}
              onClick={() => patch({ [f.id]: !filters[f.id] })}
            >
              {f.label}
            </button>
          ))}

        {isFiltering && <span className="hint mono">{shown} shown</span>}

        <span className="spacer" />

        {/*
          Disabled while a filter is on, and that is the whole bug this replaced:
          `isOpen` forces every section open whenever `isFiltering`, so a
          Collapse all that only wrote `openSections` was overruled on the very
          next render and appeared to do nothing at all. The other two pages
          guard it; this one had copied the buttons without the guard.

          Disabling rather than making it win: sections auto-open while
          filtering so you can see what matched, and a filtered view whose
          matches are collapsed is a list of headings with the answer hidden
          behind them. The title says which of the two rules is in force.
        */}
        <button
          type="button"
          className="toggle-chip"
          onClick={toggleAll}
          disabled={isFiltering}
          title={
            isFiltering
              ? 'While a filter is on, every matching category stays open'
              : allOpen
                ? 'Close every category'
                : 'Open every category'
          }
        >
          {allOpen ? <IconChevronsUp size={12} /> : <IconChevronsDown size={12} />}
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>

        <button
          type="button"
          className="toggle-chip"
          onClick={() => setColumnsOpen(true)}
          title="Choose columns"
        >
          <IconColumns size={12} />
          Columns <span className="mono dim">{columns.length}</span>
        </button>
        <span className="hint">
          <kbd>g</kbd> groups
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="empty">
          <h3>Nothing matches</h3>
          <p>Try clearing a filter, or searching for something else.</p>
        </div>
      ) : (
        visible.map((group) => (
          <SqlSection
            key={group.slug}
            group={group}
            kind={groupBy}
            columns={columns}
            open={isOpen(group.slug)}
            onToggle={() => toggleSection(group.slug)}
            onOpen={openProblem}
            categoryLabel={categoryLabel}
          />
        ))
      )}

      {filtersOpen && (
        <FiltersModal
          spec={SQL_FILTERS}
          value={filters}
          options={options}
          shown={shown}
          total={problems.length}
          onChange={patch}
          onClose={() => setFiltersOpen(false)}
          title="Bank filters"
        />
      )}

      {columnsOpen && (
        <ColumnsModal
          layout={layout}
          registry={SQL_COLUMNS}
          defaultPins={SQL_DEFAULT_PINNED}
          title="Bank columns"
          onSave={setLayout}
          onClose={() => setColumnsOpen(false)}
        />
      )}

      {open && open.mode !== 'external' && (
        <SqlWorkbench
          problem={problems.find((p) => p._id === open._id) || open}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
