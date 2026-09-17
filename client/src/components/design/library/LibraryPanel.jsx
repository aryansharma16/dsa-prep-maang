import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { layoutStructure, STRUCTURE_KINDS } from '../../../design/library/structures.js';
import { searchLibrary } from '../../../design/library/search.js';
import { SQL_TABLE_TEMPLATES } from '../../../design/library/sqlTable.js';
import { TECH, TECH_CATEGORIES } from '../../../design/library/tech.js';
import { shortcutFor } from '../../../design/engine/shortcuts.js';
import { useEditor } from '../canvas/hooks.js';
import { TechIcon } from './TechIcon.jsx';

/**
 * The component library: technologies, data-structure blocks and SQL tables.
 *
 * Click a tile to drop it in the middle of the view, or drag it to where it
 * goes. Search looks in every tab at once (`searchLibrary`) and matches names,
 * keywords and the one-line descriptions, so "queue", "cache" or "kv" find what
 * you mean even without the brand name, and "stack" finds the block from Tech.
 */

export const COMPONENT_MIME = 'application/x-sd-component';

const TABS = [
  { id: 'tech', label: 'Tech' },
  { id: 'structures', label: 'Data structures' },
  { id: 'database', label: 'Database' },
];

export const LibraryPanel = memo(function LibraryPanel({ onClose }) {
  const editor = useEditor();
  const [tab, setTab] = useState(() => {
    try {
      return localStorage.getItem('sd-library-tab') || 'tech';
    } catch {
      return 'tech';
    }
  });
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);
  // While searching, results come from every tab, so no tab shows as the one being looked at.
  const searching = query.trim() !== '';

  useEffect(() => {
    searchRef.current?.focus();
  }, [tab]);
  useEffect(() => {
    try {
      localStorage.setItem('sd-library-tab', tab);
    } catch {
      /* private mode */
    }
  }, [tab]);

  const insert = (spec) => editor.runAction('insertComponent', spec);

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (query) {
        setQuery('');
        // The tile that had focus may be a search result that is about to go; keep focus in the panel so a second Escape closes it.
        searchRef.current?.focus();
      } else onClose();
    }
  };

  return (
    <aside className="sd-library" aria-label="Component library" onKeyDown={onKeyDown} data-sd-control>
      <div className="sd-library-head">
        <div
          className="sd-segmented sd-library-tabs"
          role="tablist"
          onKeyDown={(event) => {
            const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
            if (!step) return;
            event.preventDefault();
            const at = TABS.findIndex((t) => t.id === tab);
            const next = TABS[(at + step + TABS.length) % TABS.length];
            setTab(next.id);
            setQuery('');
            event.currentTarget.querySelectorAll('[role="tab"]')[TABS.indexOf(next)]?.focus();
          }}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id && !searching}
              className={tab === t.id && !searching ? 'on' : ''}
              onClick={() => {
                setTab(t.id);
                setQuery('');
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" className="sd-icon-btn" onClick={onClose} title={`Close (${shortcutFor('library')})`} aria-label="Close library">
          ×
        </button>
      </div>
      <input
        ref={searchRef}
        className="sd-input sd-library-search"
        placeholder="Search all tabs — redis, stack, orders…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Search components"
      />
      <div className="sd-library-body">
        {searching && <SearchResults query={query} tab={tab} onInsert={insert} />}
        {!searching && tab === 'tech' && <TechTab onInsert={insert} />}
        {!searching && tab === 'structures' && <StructuresTab onInsert={insert} />}
        {!searching && tab === 'database' && <DatabaseTab onInsert={insert} />}
      </div>
      <p className="sd-library-hint">Click to add in the middle of the view, or drag onto the board.</p>
    </aside>
  );
});

function Tile({ spec, label, title, onInsert, children }) {
  return (
    <button
      type="button"
      className="sd-library-tile"
      title={title}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(COMPONENT_MIME, JSON.stringify(spec));
        event.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={() => onInsert(spec)}
    >
      <span className="sd-library-tile-art">{children}</span>
      <span className="sd-library-tile-label">{label}</span>
    </button>
  );
}

function TechTile({ entry, onInsert }) {
  return (
    <Tile spec={{ type: 'tech', tech: entry.id }} label={entry.name} title={`${entry.name} — ${entry.about}`} onInsert={onInsert}>
      <TechIcon tech={entry.id} size={26} />
    </Tile>
  );
}

function StructureTile({ kind, onInsert }) {
  return (
    <Tile spec={{ type: 'structure', kind: kind.id }} label={kind.label} title={kind.about} onInsert={onInsert}>
      <StructurePreview kind={kind} />
    </Tile>
  );
}

function TableTile({ template, onInsert }) {
  return (
    <Tile spec={{ type: 'sqltable', text: template.text }} label={template.label} title={template.text} onInsert={onInsert}>
      <span className="sd-library-table" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </Tile>
  );
}

/** Matches from all three tabs, one section each, the best-matching section first. */
function SearchResults({ query, tab, onInsert }) {
  const sections = useMemo(() => searchLibrary(query, tab), [query, tab]);
  if (!sections.length) return <p className="sd-library-empty">Nothing matches “{query.trim()}” in any tab.</p>;
  return sections.map((section) => (
    <section key={section.id} className="sd-library-group">
      <h5>
        {section.label} · {section.items.length}
      </h5>
      <div className={`sd-library-grid ${section.id === 'tech' ? '' : 'wide'}`}>
        {section.id === 'tech' && section.items.map((entry) => <TechTile key={entry.id} entry={entry} onInsert={onInsert} />)}
        {section.id === 'structures' && section.items.map((kind) => <StructureTile key={kind.id} kind={kind} onInsert={onInsert} />)}
        {section.id === 'database' && section.items.map((template) => <TableTile key={template.id} template={template} onInsert={onInsert} />)}
      </div>
    </section>
  ));
}

function TechTab({ onInsert }) {
  return TECH_CATEGORIES.map((category) => (
    <section key={category.id} className="sd-library-group">
      <h5>{category.label}</h5>
      <div className="sd-library-grid">
        {TECH.filter((entry) => entry.category === category.id).map((entry) => (
          <TechTile key={entry.id} entry={entry} onInsert={onInsert} />
        ))}
      </div>
    </section>
  ));
}

function StructurePreview({ kind }) {
  const layout = useMemo(() => layoutStructure({ kind: kind.id, text: kind.example, size: 's' }), [kind]);
  return (
    <svg className="sd-ds sd-library-ds" viewBox={`0 0 ${layout.w} ${layout.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {layout.parts.map((p, i) => {
        // A thumbnail: shapes only, no text, so it stays legible at tile size.
        if (p.t === 'rect') return <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={3} className={`sd-ds-cell ${p.hot ? 'hot' : ''}`} />;
        if (p.t === 'circle') return <circle key={i} cx={p.cx} cy={p.cy} r={p.r} className={`sd-ds-node ${p.filled ? 'filled' : ''}`} />;
        if ((p.t === 'line' || p.t === 'arrow') && !p.invisible) return <polyline key={i} points={p.points.map((pt) => pt.join(',')).join(' ')} className="sd-ds-line" />;
        if (p.t === 'cylinder') return <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.w / 3} className="sd-ds-cell" />;
        return null;
      })}
    </svg>
  );
}

function StructuresTab({ onInsert }) {
  return (
    <section className="sd-library-group">
      <div className="sd-library-grid wide">
        {STRUCTURE_KINDS.map((kind) => (
          <StructureTile key={kind.id} kind={kind} onInsert={onInsert} />
        ))}
      </div>
      <p className="sd-library-note">
        Double-click a block to edit it: one item per line, <code>*</code> in front highlights an item, trees take LeetCode&rsquo;s{' '}
        <code>[1,2,null,3]</code>.
      </p>
    </section>
  );
}

const SCALING_KINDS = STRUCTURE_KINDS.filter((kind) => kind.id === 'shards' || kind.id === 'hashring');
const DATABASE_TECH = TECH.filter((entry) => entry.category === 'sql' || entry.category === 'nosql' || entry.category === 'cache').slice(0, 12);

function DatabaseTab({ onInsert }) {
  return (
    <>
      <section className="sd-library-group">
        <h5>SQL tables</h5>
        <div className="sd-library-grid wide">
          {SQL_TABLE_TEMPLATES.map((template) => (
            <TableTile key={template.id} template={template} onInsert={onInsert} />
          ))}
        </div>
        <p className="sd-library-note">Columns are DBML — the same text a schema board and dbdiagram.io use.</p>
      </section>
      <section className="sd-library-group">
        <h5>Scaling data</h5>
        <div className="sd-library-grid wide">
          {SCALING_KINDS.map((kind) => (
            <StructureTile key={kind.id} kind={kind} onInsert={onInsert} />
          ))}
        </div>
      </section>
      <section className="sd-library-group">
        <h5>Databases & caches</h5>
        <div className="sd-library-grid">
          {DATABASE_TECH.map((entry) => (
            <TechTile key={entry.id} entry={entry} onInsert={onInsert} />
          ))}
        </div>
      </section>
    </>
  );
}
