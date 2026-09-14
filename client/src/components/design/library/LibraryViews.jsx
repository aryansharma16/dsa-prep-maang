import { memo, useMemo } from 'react';
import { layoutStructure } from '../../../design/library/structures.js';
import { parseSqlTable } from '../../../design/library/sqlTable.js';
import { TECH_BY_ID } from '../../../design/library/tech.js';
import { SCHEMA_METRICS } from '../../../design/schema/layout.js';
import { TechIcon } from './TechIcon.jsx';

/**
 * Views for the component library's elements: technology cards, data-structure
 * blocks and SQL tables. Pure functions of the record, like every other view.
 */

/* -------------------------------------------------------------------------- */
/* tech                                                                        */
/* -------------------------------------------------------------------------- */

export const TechView = memo(function TechView({ record, editing }) {
  const { data } = record;
  const entry = TECH_BY_ID[data.tech];
  const w = Math.max(1, data.w || 1);
  const h = Math.max(1, data.h || 1);
  const label = data.label || entry?.name || 'Component';
  const showLabel = !data.hideLabel && label;
  const icon = Math.round(Math.max(18, Math.min(96, Math.min(w, h - (showLabel ? 22 : 0)) * 0.5)));
  return (
    <div
      className={`sd-tech ${data.appearance === 'plain' ? 'plain' : 'card'} ${data.mono ? 'mono' : ''}`}
      style={{ '--tech': entry?.color || '#64748b' }}
      title={entry?.about}
    >
      <TechIcon tech={data.tech} size={icon} mono={data.mono} />
      {showLabel && !editing && <span className="sd-tech-label">{label}</span>}
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/* data-structure blocks                                                       */
/* -------------------------------------------------------------------------- */

function arrowHead([x0, y0], [x1, y1], size = 7) {
  const angle = Math.atan2(y1 - y0, x1 - x0);
  const a = (da) => `${x1 - size * Math.cos(angle + da)},${y1 - size * Math.sin(angle + da)}`;
  return `M${a(-0.45)} L${x1},${y1} L${a(0.45)}`;
}

function Primitive({ p }) {
  switch (p.t) {
    case 'rect':
      return <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={p.r ?? 4} className={`sd-ds-cell ${p.hot ? 'hot' : ''} ${p.ghost ? 'ghost' : ''} ${p.dashed ? 'dashed' : ''}`} />;
    case 'cylinder': {
      const ry = Math.min(p.h * 0.14, 12);
      return (
        <g className={`sd-ds-cylinder ${p.hot ? 'hot' : ''}`}>
          <path d={`M${p.x},${p.y + ry} L${p.x},${p.y + p.h - ry} A${p.w / 2},${ry} 0 0 0 ${p.x + p.w},${p.y + p.h - ry} L${p.x + p.w},${p.y + ry}`} />
          <ellipse cx={p.x + p.w / 2} cy={p.y + ry} rx={p.w / 2} ry={ry} />
        </g>
      );
    }
    case 'circle':
      return <circle cx={p.cx} cy={p.cy} r={p.r} className={`sd-ds-node ${p.filled ? 'filled' : ''} ${p.hot ? 'hot' : ''}`} />;
    case 'line':
      if (p.invisible) return null;
      return <polyline points={p.points.map((pt) => pt.join(',')).join(' ')} className={`sd-ds-line ${p.strong ? 'strong' : ''} ${p.faint ? 'faint' : ''}`} />;
    case 'arrow':
      return (
        <g className="sd-ds-arrow">
          <polyline points={p.points.map((pt) => pt.join(',')).join(' ')} />
          <path d={arrowHead(p.points.at(-2), p.points.at(-1))} />
        </g>
      );
    case 'text': {
      const anchor = p.anchor === 'start' ? 'start' : p.anchor === 'end' ? 'end' : 'middle';
      return (
        <text x={p.x} y={p.y} textAnchor={anchor} dominantBaseline="central" fontSize={p.size} className={`sd-ds-text ${p.muted ? 'muted' : ''} ${p.hot ? 'hot' : ''} ${p.bold ? 'bold' : ''}`}>
          {p.text}
        </text>
      );
    }
    default:
      return null;
  }
}

export const StructureView = memo(function StructureView({ record, editing }) {
  const { data } = record;
  const layout = useMemo(() => layoutStructure(data), [data]);
  if (editing) return null;
  return (
    <svg className="sd-svg sd-ds" width={layout.w} height={layout.h} viewBox={`0 0 ${layout.w} ${layout.h}`} overflow="visible" aria-hidden="true">
      {layout.parts.map((p, i) => (
        // eslint-disable-next-line react/no-array-index-key -- primitives have no identity beyond their position
        <Primitive key={i} p={p} />
      ))}
    </svg>
  );
});

/* -------------------------------------------------------------------------- */
/* SQL table                                                                   */
/* -------------------------------------------------------------------------- */

const KeyGlyph = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
    <circle cx="5" cy="11" r="3" />
    <path d="M7.2 8.8L14 2M11.5 4.5l2 2" />
  </svg>
);
const LinkGlyph = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
    <path d="M2 8h9M8 4.5L11.5 8 8 11.5M14 3v10" />
  </svg>
);

export const SqlTableView = memo(function SqlTableView({ record, editing }) {
  const { data } = record;
  const { table, diagnostics } = useMemo(() => parseSqlTable(data.text), [data.text]);
  if (editing) return null;
  const errors = diagnostics.filter((d) => d.severity === 'error');
  const title = table ? `${table.schema && table.schema !== 'public' ? `${table.schema}.` : ''}${table.name}` : 'table';
  return (
    <div className="sd-sqltable" style={{ '--head': `${SCHEMA_METRICS.headerH}px`, '--row': `${SCHEMA_METRICS.rowH}px` }}>
      <div className="sd-sqltable-head" title={table?.note || undefined}>
        <span className="sd-sqltable-name">{title}</span>
        {errors.length > 0 && (
          <span className="sd-sqltable-error" title={errors[0].message}>
            {errors.length}
          </span>
        )}
      </div>
      {table?.columns.length ? (
        table.columns.map((column, index) => {
          const type = column.type.name + (column.type.args?.length ? `(${column.type.args.join(',')})` : '') + (column.type.array ? '[]' : '');
          return (
            <div key={`${index}:${column.name}`} className={`sd-sqltable-row ${column.pk ? 'pk' : ''}`} title={column.note || undefined}>
              <span className="sd-sqltable-mark">{column.pk ? <KeyGlyph /> : column.refs.length ? <LinkGlyph /> : null}</span>
              <span className={`sd-sqltable-col ${column.notNull || column.pk ? 'required' : ''}`}>{column.name}</span>
              {column.unique && !column.pk && <span className="sd-sqltable-flag">unique</span>}
              <span className="sd-sqltable-type">{type}</span>
            </div>
          );
        })
      ) : (
        <div className="sd-sqltable-row empty">Double-click to add columns</div>
      )}
    </div>
  );
});
