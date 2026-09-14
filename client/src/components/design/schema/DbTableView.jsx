import { memo } from 'react';
import { SCHEMA_METRICS } from '../../../design/schema/layout.js';
import { useUi } from '../canvas/hooks.js';
import { useSchemaModel } from './useSchema.js';

/**
 * A table on a schema board. The element holds where it is; what it is — name,
 * columns, keys, notes — comes from the board's DBML (the schema model).
 *
 * The column under the text editor's caret is highlighted, so reading the text
 * and reading the diagram are one activity.
 */

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

export const DbTableView = memo(function DbTableView({ record }) {
  const model = useSchemaModel();
  const focus = useUi((s) => s.schemaFocus);
  const table = model.byKey.get(record.data.name);
  const focusedTable = focus?.table === record.data.name;

  if (!table) {
    return (
      <div className="sd-sqltable sd-dbtable missing" style={{ '--head': `${SCHEMA_METRICS.headerH}px`, '--row': `${SCHEMA_METRICS.rowH}px` }}>
        <div className="sd-sqltable-head">
          <span className="sd-sqltable-name">{record.data.name?.replace(/^public\./, '')}</span>
        </div>
        <div className="sd-sqltable-row empty">Not in the text</div>
      </div>
    );
  }

  const referenced = new Set(model.relations.flatMap((r) => (r.to.table === table.key ? r.to.columns : [])));
  const title = `${table.schema && table.schema !== 'public' ? `${table.schema}.` : ''}${table.name}`;
  return (
    <div
      className={`sd-sqltable sd-dbtable ${table.stale ? 'stale' : ''} ${focusedTable ? 'focused' : ''}`}
      style={{ '--head': `${SCHEMA_METRICS.headerH}px`, '--row': `${SCHEMA_METRICS.rowH}px`, ...(table.headerColor ? { '--table-head': table.headerColor } : {}) }}
    >
      <div className="sd-sqltable-head" title={table.note || undefined}>
        <span className="sd-sqltable-name">{title}</span>
        {table.alias && <span className="sd-dbtable-alias">as {table.alias}</span>}
        {table.note && <span className="sd-dbtable-note" aria-label="Has a note" />}
      </div>
      {table.columns.map((column, index) => {
        const type = column.type.name + (column.type.args?.length ? `(${column.type.args.join(',')})` : '') + (column.type.array ? '[]' : '');
        const isFk = column.refs.length > 0 || model.relations.some((r) => r.from.table === table.key && r.from.columns.includes(column.name));
        return (
          <div
            key={`${index}:${column.name}`}
            className={`sd-sqltable-row ${column.pk ? 'pk' : ''} ${focusedTable && focus.column === column.name ? 'focused' : ''} ${referenced.has(column.name) ? 'referenced' : ''}`}
            title={column.note || undefined}
          >
            <span className="sd-sqltable-mark">{column.pk ? <KeyGlyph /> : isFk ? <LinkGlyph /> : null}</span>
            <span className={`sd-sqltable-col ${column.notNull || column.pk ? 'required' : ''}`}>{column.name}</span>
            {column.unique && !column.pk && <span className="sd-sqltable-flag">unique</span>}
            {column.enum && <span className="sd-sqltable-flag">enum</span>}
            <span className="sd-sqltable-type">{type}</span>
          </div>
        );
      })}
    </div>
  );
});
