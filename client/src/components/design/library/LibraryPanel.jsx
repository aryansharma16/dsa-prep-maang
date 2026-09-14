import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { layoutStructure, STRUCTURE_KINDS } from '../../../design/library/structures.js';
import { SQL_TABLE_TEMPLATES } from '../../../design/library/sqlTable.js';
import { searchTech, TECH, TECH_CATEGORIES } from '../../../design/library/tech.js';
import { shortcutFor } from '../../../design/engine/shortcuts.js';
import { useEditor } from '../canvas/hooks.js';
import { TechIcon } from './TechIcon.jsx';

/**
 * The component library: technologies, data-structure blocks and SQL tables.
 *
 * Click a tile to drop it in the middle of the view, or drag it to where it
 * goes. Search matches names, keywords and the one-line descriptions, so
 * "queue", "cache" or "kv" find what you mean even without the brand name.
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
      if (query) setQuery('');
      else onClose();
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
              aria-selected={tab === t.id}
              className={tab === t.id ? 'on' : ''}
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
        placeholder={tab === 'tech' ? 'Search 170+ components — redis, queue, cdn…' : 'Search'}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Search components"
      />
      <div className="sd-library-body">
        {tab === 'tech' && <TechTab query={query} onInsert={insert} />}
        {tab === 'structures' && <StructuresTab query={query} onInsert={insert} />}
        {tab === 'database' && <DatabaseTab query={query} onInsert={insert} />}
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

function TechTab({ query, onInsert }) {
  const groups = useMemo(() => {
    const matches = searchTech(query, TECH);
    if (query.trim()) return [{ id: 'results', label: `${matches.length} result${matches.length === 1 ? '' : 's'}`, entries: matches }];
    return TECH_CATEGORIES.map((c) => ({ ...c, entries: TECH.filter((t) => t.category === c.id) }));
  }, [query]);
  return groups.map((group) => (
    <section key={group.id} className="sd-library-group">
      <h5>{group.label}</h5>
      <div className="sd-library-grid">
        {group.entries.map((entry) => (
          <Tile key={entry.id} spec={{ type: 'tech', tech: entry.id }} label={entry.name} title={`${entry.name} — ${entry.about}`} onInsert={onInsert}>
            <TechIcon tech={entry.id} size={26} />
          </Tile>
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

function StructuresTab({ query, onInsert }) {
  const q = query.trim().toLowerCase();
  const kinds = STRUCTURE_KINDS.filter((k) => !q || k.label.toLowerCase().includes(q) || k.about.toLowerCase().includes(q));
  return (
    <section className="sd-library-group">
      <div className="sd-library-grid wide">
        {kinds.map((kind) => (
          <Tile key={kind.id} spec={{ type: 'structure', kind: kind.id }} label={kind.label} title={kind.about} onInsert={onInsert}>
            <StructurePreview kind={kind} />
          </Tile>
        ))}
      </div>
      {!kinds.length && <p className="sd-library-empty">Nothing matches “{query}”.</p>}
      <p className="sd-library-note">
        Double-click a block to edit it: one item per line, <code>*</code> in front highlights an item, trees take LeetCode&rsquo;s{' '}
        <code>[1,2,null,3]</code>.
      </p>
    </section>
  );
}

function DatabaseTab({ query, onInsert }) {
  const q = query.trim().toLowerCase();
  const tables = SQL_TABLE_TEMPLATES.filter((t) => !q || t.label.toLowerCase().includes(q) || t.text.toLowerCase().includes(q));
  const kinds = STRUCTURE_KINDS.filter((k) => (k.id === 'shards' || k.id === 'hashring') && (!q || k.label.toLowerCase().includes(q)));
  const tech = searchTech(q, TECH.filter((t) => t.category === 'sql' || t.category === 'nosql' || t.category === 'cache')).slice(0, q ? 40 : 12);
  if (q && !tables.length && !kinds.length && !tech.length) return <p className="sd-library-empty">Nothing matches “{query}”.</p>;
  return (
    <>
      {tables.length > 0 && (
        <section className="sd-library-group">
          <h5>SQL tables</h5>
          <div className="sd-library-grid wide">
            {tables.map((template) => (
              <Tile key={template.id} spec={{ type: 'sqltable', text: template.text }} label={template.label} title={template.text} onInsert={onInsert}>
                <span className="sd-library-table" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </Tile>
            ))}
          </div>
          <p className="sd-library-note">Columns are DBML — the same text a schema board and dbdiagram.io use.</p>
        </section>
      )}
      {kinds.length > 0 && (
        <section className="sd-library-group">
          <h5>Scaling data</h5>
          <div className="sd-library-grid wide">
            {kinds.map((kind) => (
              <Tile key={kind.id} spec={{ type: 'structure', kind: kind.id }} label={kind.label} title={kind.about} onInsert={onInsert}>
                <StructurePreview kind={kind} />
              </Tile>
            ))}
          </div>
        </section>
      )}
      {tech.length > 0 && (
        <section className="sd-library-group">
          <h5>Databases & caches</h5>
          <div className="sd-library-grid">
            {tech.map((entry) => (
              <Tile key={entry.id} spec={{ type: 'tech', tech: entry.id }} label={entry.name} title={`${entry.name} — ${entry.about}`} onInsert={onInsert}>
                <TechIcon tech={entry.id} size={26} />
              </Tile>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
