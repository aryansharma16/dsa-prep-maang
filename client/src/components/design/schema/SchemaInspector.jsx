import { useState } from 'react';
import { columnLine } from '../../../design/schema/edits.js';
import { useEditor, useUi } from '../canvas/hooks.js';
import { useSchemaModel } from './useSchema.js';

/**
 * The properties panel for a schema board: the selected table's columns as a
 * small grid (name, type, key / not null / unique), its relations, and — when a
 * relation line is clicked — that relation's kind.
 *
 * Every control is a text edit through the board's schema (schemaSync.js), so it
 * lands in the DBML exactly where a person would have typed it.
 */

const OPS = [
  { value: '>', label: 'many → one' },
  { value: '<', label: 'one → many' },
  { value: '-', label: 'one ↔ one' },
  { value: '<>', label: 'many ↔ many' },
];

const shortKey = (key) => key.replace(/^public\./, '');

export function SchemaInspector({ record }) {
  const editor = useEditor();
  const schema = editor.schema;
  const model = useSchemaModel();
  const readOnly = useUi((s) => s.readOnly);
  const table = model.byKey.get(record.data.name);
  const [adding, setAdding] = useState('');

  if (!schema) return null;
  if (!table) {
    return (
      <section className="sd-section-block">
        <h5>Table</h5>
        <p className="sd-field-about">This position belongs to a table that is no longer in the text. It is removed shortly unless the table comes back.</p>
      </section>
    );
  }

  const setColumn = (column, patch) => schema.replaceColumn(table.key, column.name, columnLine({ ...column, ...patch }));
  const relations = model.relations.filter((r) => r.from.table === table.key || r.to.table === table.key);

  return (
    <>
      <section className="sd-section-block">
        <h5>Table</h5>
        <label className="sd-field">
          <span className="sd-field-label">Name</span>
          <input
            key={table.key}
            className="sd-input"
            defaultValue={table.name}
            disabled={readOnly}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== table.name && schema.renameTable(table.key, e.target.value.trim())}
          />
        </label>
        {table.note && <p className="sd-field-about">{table.note}</p>}
        <button type="button" className="link-btn" onClick={() => editor.ui.set({ schemaReveal: table.nameSpan })}>
          Show in text
        </button>
      </section>

      <section className="sd-section-block">
        <h5>Columns</h5>
        <div className="sd-cols" role="table" aria-label={`Columns of ${table.name}`}>
          <div className="sd-cols-head" role="row">
            <span role="columnheader">Name</span>
            <span role="columnheader">Type</span>
            <span role="columnheader" title="Primary key">PK</span>
            <span role="columnheader" title="Not null">NN</span>
            <span role="columnheader" title="Unique">U</span>
            <span />
          </div>
          {table.columns.map((column) => {
            const type = column.type.name + (column.type.args?.length ? `(${column.type.args.join(',')})` : '') + (column.type.array ? '[]' : '');
            return (
              <div key={`${table.key}.${column.name}`} className="sd-cols-row" role="row">
                <input
                  className="sd-input mono"
                  defaultValue={column.name}
                  disabled={readOnly}
                  aria-label="Column name"
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== column.name && schema.renameColumn(table.key, column.name, e.target.value.trim())}
                />
                <input
                  className="sd-input mono"
                  defaultValue={type}
                  disabled={readOnly}
                  aria-label="Column type"
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (!value || value === type) return;
                    const match = value.match(/^(.+?)(?:\((.*)\))?(\[\])?$/);
                    setColumn(column, { type: { name: match[1].trim(), args: match[2] ? match[2].split(',').map((a) => a.trim()) : null, array: Boolean(match[3]) } });
                  }}
                />
                <input type="checkbox" checked={column.pk} disabled={readOnly} aria-label="Primary key" onChange={(e) => setColumn(column, { pk: e.target.checked })} />
                <input type="checkbox" checked={column.pk || column.notNull} disabled={readOnly || column.pk} aria-label="Not null" onChange={(e) => setColumn(column, { notNull: e.target.checked, nullable: e.target.checked ? false : column.nullable })} />
                <input type="checkbox" checked={column.pk || column.unique} disabled={readOnly || column.pk} aria-label="Unique" onChange={(e) => setColumn(column, { unique: e.target.checked })} />
                <button type="button" className="sd-icon-btn sm" disabled={readOnly} aria-label={`Delete column ${column.name}`} title="Delete column" onClick={() => schema.removeColumn(table.key, column.name)}>
                  ×
                </button>
              </div>
            );
          })}
        </div>
        {!readOnly && (
          <form
            className="sd-cols-add"
            onSubmit={(e) => {
              e.preventDefault();
              const line = adding.trim();
              if (!line) return;
              schema.addColumn(table.key, /\s/.test(line) ? line : `${line} varchar`);
              setAdding('');
            }}
          >
            <input className="sd-input mono" value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="email varchar(255) [not null]" aria-label="New column" />
            <button type="submit" className="btn ghost sm" disabled={!adding.trim()}>
              Add
            </button>
          </form>
        )}
      </section>

      {relations.length > 0 && (
        <section className="sd-section-block">
          <h5>Relations</h5>
          {relations.map((relation) => (
            <RelationRow key={relation.id} relation={relation} readOnly={readOnly} />
          ))}
        </section>
      )}

      {!readOnly && (
        <section className="sd-section-block">
          <button type="button" className="btn ghost sm danger" onClick={() => schema.deleteTable(table.key)}>
            Delete table
          </button>
        </section>
      )}
    </>
  );
}

function RelationRow({ relation, readOnly }) {
  const editor = useEditor();
  const schema = editor.schema;
  return (
    <div className="sd-relation-row">
      <span className="mono" title={relation.name || undefined}>
        {shortKey(relation.from.table)}.{relation.from.columns.join(',')} → {shortKey(relation.to.table)}.{relation.to.columns.join(',')}
      </span>
      <select className="sd-input" value={relation.op} disabled={readOnly} aria-label="Relation kind" onChange={(e) => schema.setRelationOp(relation, e.target.value)}>
        {OPS.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>
      <button type="button" className="sd-icon-btn sm" disabled={readOnly} aria-label="Delete relation" title="Delete relation" onClick={() => schema.removeRelation(relation)}>
        ×
      </button>
    </div>
  );
}

/** Shown when a relation line is selected on the board. */
export function RelationInspector({ relationId }) {
  const model = useSchemaModel();
  const readOnly = useUi((s) => s.readOnly);
  const relation = model.relations.find((r) => r.id === relationId);
  if (!relation) return null;
  return (
    <section className="sd-section-block">
      <h5>Relation</h5>
      <RelationRow relation={relation} readOnly={readOnly} />
      {(relation.onDelete || relation.onUpdate) && (
        <p className="sd-field-about">
          {relation.onDelete && `on delete ${relation.onDelete}`} {relation.onUpdate && `on update ${relation.onUpdate}`}
        </p>
      )}
    </section>
  );
}
