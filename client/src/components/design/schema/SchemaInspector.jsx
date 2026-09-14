import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  buildColumnLine,
  columnDeletionSummary,
  columnPresets,
  defaultSuggestions,
  defaultText,
  foreignKeyColumn,
  guessColumn,
  lineColumnName,
  parseDefault,
  parseTypeText,
  primaryKeyOf,
  RELATION_KINDS,
  relationDeletionSummary,
  tableDeletionSummary,
  typeText,
  validTypeText,
} from '../../../design/schema/assist.js';
import { columnLine } from '../../../design/schema/edits.js';
import { shortcutFor } from '../../../design/engine/shortcuts.js';
import { useEditor, useUi } from '../canvas/hooks.js';
import { ColorPopover } from '../ui/ColorPopover.jsx';
import { PickList } from '../ui/PickList.jsx';
import { TypeInput } from './TypeInput.jsx';
import { useSchemaModel } from './useSchema.js';

/**
 * The properties panel for a schema board: the selected table's columns as a
 * small grid (name, type, key / not null / unique), each with more settings
 * behind its arrow (default, auto-increment, reference, note), ways to add
 * columns quickly, its relations, and — when a relation line is clicked — that
 * relation's kind.
 *
 * Adding is built for speed: type a column name and the type is guessed from it
 * (`user_id` → the key type of `users`, referencing it; `created_at` → a
 * timestamp), Enter adds it and leaves the field ready for the next. Common
 * columns are one click, and "Link to table" adds a foreign key.
 *
 * Every control is a text edit through the board's schema (schemaSync.js), so it
 * lands in the DBML exactly where a person would have typed it.
 */

const OPS = RELATION_KINDS;
const opAbout = (op) => OPS.find((o) => o.value === op)?.about;

const shortKey = (key) => key.replace(/^public\./, '');
const INTEGER = /^(int|integer|bigint|smallint|tinyint|mediumint|int2|int4|int8|serial|bigserial)$/i;
const refKey = (target) => `${target.schema || 'public'}.${target.table}`;

// Header colours, written as hex so the DBML pastes into dbdiagram as it is. Mid-tones that read on both themes.
const TABLE_COLORS = [
  ['Blue', '#3b82f6'],
  ['Sky', '#0ea5e9'],
  ['Teal', '#14b8a6'],
  ['Green', '#22c55e'],
  ['Lime', '#84cc16'],
  ['Yellow', '#eab308'],
  ['Orange', '#f97316'],
  ['Red', '#ef4444'],
  ['Pink', '#ec4899'],
  ['Purple', '#a855f7'],
  ['Indigo', '#6366f1'],
  ['Slate', '#64748b'],
];

/** Asks before a delete (BoardEditor shows `ui.confirm`); undo still works afterwards. */
const askToDelete = (editor, summary, confirmLabel, onConfirm) =>
  editor.ui.set({ confirm: { ...summary, detail: `Undo (${shortcutFor('undo')}) brings it back.`, confirmLabel, onConfirm } });

/** The four relation kinds, described for this relation's two tables. */
function kindOptions(from, to) {
  const a = shortKey(from.table);
  const b = shortKey(to.table);
  const about = {
    '>': `Many ${a} rows point to one ${b} row — the usual foreign key (${a}.${from.columns.join(', ')} → ${b}.${to.columns.join(', ')})`,
    '<': `One ${a} row, many ${b} rows — the same link read from the other side`,
    '-': `Each ${a} row matches at most one ${b} row, like a user and their profile`,
    '<>': `Many ${a} rows to many ${b} rows — exported as a junction table holding both keys`,
  };
  return OPS.map((op) => ({ value: op.value, label: op.label, meta: op.value, about: about[op.value] }));
}
const KIND_INTRO = "How many rows can sit on each side of the link. It sets the crow's-foot ends of the line; many ↔ many also becomes a junction table on export.";

const TIPS = {
  pk: 'Primary key — The column that identifies each row. Always unique and never empty',
  nn: 'Not null — A value is required; an insert without one fails',
  u: 'Unique — No two rows may have the same value (adds an index)',
};

export function SchemaInspector({ record }) {
  const editor = useEditor();
  const schema = editor.schema;
  const model = useSchemaModel();
  const readOnly = useUi((s) => s.readOnly);
  const newTable = useUi((s) => s.schemaNewTable);
  const table = model.byKey.get(record.data.name);
  const [openColumn, setOpenColumn] = useState(null);
  const nameRef = useRef(null);
  const addRef = useRef(null);

  // A table just added: its name is the first thing to type.
  useEffect(() => {
    if (!newTable || newTable !== table?.key) return undefined;
    // After the click or double-click that added it has finished moving focus around; the flag is cleared then,
    // since clearing it here would re-run this effect and cancel the frame.
    const frame = requestAnimationFrame(() => {
      editor.ui.set({ schemaNewTable: null });
      nameRef.current?.focus();
      nameRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [newTable, table?.key, editor]);

  if (!schema) return null;
  if (!table) {
    return (
      <section className="sd-section-block">
        <h5>Table</h5>
        <p className="sd-field-about">This position belongs to a table that is no longer in the text. It is removed shortly unless the table comes back.</p>
      </section>
    );
  }

  const relations = model.relations.filter((r) => r.from.table === table.key || r.to.table === table.key);

  return (
    <>
      <section className="sd-section-block">
        <h5>Table</h5>
        <label className="sd-field">
          <span className="sd-field-label">Name</span>
          <input
            key={table.key}
            ref={nameRef}
            className="sd-input"
            defaultValue={table.name}
            disabled={readOnly}
            spellCheck={false}
            title="Table name — Plural and snake_case by convention: users, order_items. Renaming updates every reference"
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              // On to the first column; leaving the field renames.
              if (addRef.current) addRef.current.focus();
              else e.currentTarget.blur();
            }}
            onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== table.name && schema.renameTable(table.key, e.target.value.trim())}
          />
        </label>
        <TableColor table={table} readOnly={readOnly} />
        {table.note && <p className="sd-field-about">{table.note}</p>}
        <button type="button" className="link-btn" onClick={() => editor.ui.set({ schemaReveal: table.nameSpan })} title="Select this table's DBML in the text panel">
          Show in text
        </button>
      </section>

      <section className="sd-section-block">
        <h5>Columns</h5>
        <div className="sd-cols" role="table" aria-label={`Columns of ${table.name}`}>
          <div className="sd-cols-head" role="row">
            <span />
            <span role="columnheader" title="Column name — snake_case; a name ending in _id usually references another table">
              Name
            </span>
            <span role="columnheader" title="Type — What the column holds. Click a type for the list of common ones">
              Type
            </span>
            <span role="columnheader" title={TIPS.pk}>
              PK
            </span>
            <span role="columnheader" title={TIPS.nn}>
              NN
            </span>
            <span role="columnheader" title={TIPS.u}>
              U
            </span>
            <span />
          </div>
          {table.columns.map((column) => (
            <ColumnRow
              key={`${table.key}.${column.name}`}
              table={table}
              column={column}
              model={model}
              readOnly={readOnly}
              open={openColumn === `${table.key}.${column.name}`}
              onToggle={() => setOpenColumn((current) => (current === `${table.key}.${column.name}` ? null : `${table.key}.${column.name}`))}
            />
          ))}
          {!table.columns.length && <p className="sd-field-about">No columns yet — add one below.</p>}
        </div>
        {!readOnly && (
          <>
            <AddColumn key={record.id} table={table} model={model} inputRef={addRef} />
            <QuickAdd table={table} model={model} />
          </>
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
          <button
            type="button"
            className="btn ghost sm danger"
            onClick={() => askToDelete(editor, tableDeletionSummary(model, [table.key]), 'Delete table', () => schema.deleteTable(table.key))}
            title="Delete table — Removes the table, its relations and references to it. Asks first; undo brings it all back"
          >
            Delete table
          </button>
        </section>
      )}
    </>
  );
}

function TableColor({ table, readOnly }) {
  const schema = useEditor().schema;
  const current = table.headerColor?.toLowerCase() || null;
  const custom = current && !TABLE_COLORS.some(([, hex]) => hex === current);
  const [picking, setPicking] = useState(false);
  const customRef = useRef(null);
  const closePicker = useCallback(() => setPicking(false), []);
  return (
    <div className="sd-field">
      <span className="sd-field-label">Colour</span>
      <div className="sd-table-colors" role="radiogroup" aria-label="Table colour">
        <button
          type="button"
          role="radio"
          aria-checked={!current}
          aria-label="Board colour"
          title="Board colour — Follow the project's colour (removes headercolor)"
          className={`sd-table-color default ${!current ? 'on' : ''}`}
          disabled={readOnly}
          onClick={() => schema.setTableColor(table.key, null)}
        />
        {TABLE_COLORS.map(([name, hex]) => (
          <button
            key={hex}
            type="button"
            role="radio"
            aria-checked={current === hex}
            aria-label={name}
            title={`${name} — headercolor: ${hex}`}
            className={`sd-table-color ${current === hex ? 'on' : ''}`}
            style={{ '--swatch': hex }}
            disabled={readOnly}
            onClick={() => schema.setTableColor(table.key, hex)}
          />
        ))}
        <button
          ref={customRef}
          type="button"
          role="radio"
          aria-checked={Boolean(custom)}
          aria-label="Custom colour"
          aria-haspopup="dialog"
          aria-expanded={picking}
          title="Custom colour — Pick any colour, written as hex"
          className={`sd-table-color custom ${custom ? 'on' : ''}`}
          style={custom ? { '--swatch': current } : undefined}
          disabled={readOnly}
          onClick={() => setPicking((v) => !v)}
        />
      </div>
      {picking && <ColorPopover anchor={customRef.current} value={current || '#3b82f6'} label="Table colour" onChange={(hex, live) => schema.setTableColor(table.key, hex, live)} onClose={closePicker} />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ColumnRow({ table, column, model, readOnly, open, onToggle }) {
  const editor = useEditor();
  const schema = editor.schema;
  const set = (patch) => schema.replaceColumn(table.key, column.name, columnLine({ ...column, ...patch }));
  const type = typeText(column.type);
  const outgoing = model.relations.filter((r) => r.from.table === table.key && r.from.columns.includes(column.name));
  const incoming = model.relations.filter((r) => r.to.table === table.key && r.to.columns.includes(column.name));
  const summary = [
    column.pk && 'Primary key',
    column.increment && 'auto-increment',
    column.default && `default ${defaultText(column.default)}`,
    ...outgoing.map((r) => `references ${shortKey(r.to.table)}.${r.to.columns.join(',')}`),
    incoming.length && `referenced by ${incoming.map((r) => `${shortKey(r.from.table)}.${r.from.columns.join(',')}`).join(', ')}`,
  ].filter(Boolean);
  const nameTip = `${column.name}${summary.length || column.note ? ` — ${[summary.join(' · '), column.note].filter(Boolean).join('. ')}` : ''}`;

  return (
    <>
      <div className={`sd-cols-row ${open ? 'open' : ''} ${outgoing.length ? 'fk' : ''} ${column.pk ? 'pk' : ''}`} role="row">
        <button
          type="button"
          className="sd-cols-more"
          aria-expanded={open}
          aria-label={`More settings for ${column.name}`}
          title={`More settings — Default value, auto-increment, reference and note for ${column.name}`}
          onClick={onToggle}
        >
          ›
        </button>
        <input
          className="sd-input mono sd-cols-name"
          defaultValue={column.name}
          disabled={readOnly}
          spellCheck={false}
          aria-label="Column name"
          title={nameTip}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== column.name && schema.renameColumn(table.key, column.name, e.target.value.trim())}
        />
        <TypeInput value={type} model={model} disabled={readOnly} label={`Type of ${column.name}`} onCommit={(text) => set({ type: parseTypeText(text) })} />
        <input type="checkbox" checked={column.pk} disabled={readOnly} aria-label="Primary key" title={TIPS.pk} onChange={(e) => set({ pk: e.target.checked })} />
        <input
          type="checkbox"
          checked={column.pk || column.notNull}
          disabled={readOnly || column.pk}
          aria-label="Not null"
          title={column.pk ? 'Not null — A primary key is never null' : TIPS.nn}
          onChange={(e) => set({ notNull: e.target.checked, nullable: e.target.checked ? false : column.nullable })}
        />
        <input
          type="checkbox"
          checked={column.pk || column.unique}
          disabled={readOnly || column.pk}
          aria-label="Unique"
          title={column.pk ? 'Unique — A primary key is always unique' : TIPS.u}
          onChange={(e) => set({ unique: e.target.checked })}
        />
        <button type="button" className="sd-icon-btn sm" disabled={readOnly} aria-label={`Delete column ${column.name}`} title={`Delete column — Removes ${column.name} and relations through it. Asks first`} onClick={() => askToDelete(editor, columnDeletionSummary(model, table.key, column.name), 'Delete column', () => schema.removeColumn(table.key, column.name))}>
          ×
        </button>
      </div>
      {open && <ColumnDetails table={table} column={column} model={model} readOnly={readOnly} set={set} hasRefLine={outgoing.some((r) => !r.inline)} />}
    </>
  );
}

function ColumnDetails({ table, column, model, readOnly, set, hasRefLine }) {
  const listId = useId();
  const suggestions = defaultSuggestions(column.type.name, model);
  const current = column.refs[0] || null;
  const currentValue = current ? `${refKey(current.target)}|${current.target.columns.join(',')}` : '';
  // Columns worth pointing at: keys and unique columns, the current target whatever it is.
  const targets = model.tables
    .map((t) => ({ table: t, columns: t.columns.filter((c) => c.pk || c.unique || (current && refKey(current.target) === t.key && current.target.columns.includes(c.name))) }))
    .filter((t) => t.columns.length);
  const known = targets.some((t) => t.columns.some((c) => `${t.table.key}|${c.name}` === currentValue));

  const setRef = (value, op = current?.op || '>') => {
    if (!value) return set({ refs: column.refs.slice(1) });
    const [key, columns] = value.split('|');
    const [schemaName, ...rest] = key.split('.');
    const ref = { op, target: { schema: schemaName === 'public' ? null : schemaName, table: rest.join('.'), columns: columns.split(',') } };
    return set({ refs: [ref, ...column.refs.slice(1)] });
  };

  return (
    <div className="sd-col-details">
      <label className="sd-col-detail" title="Default — The value used when an insert leaves this column out. Expressions like now() run in the database">
        <span>Default</span>
        <input
          key={defaultText(column.default)}
          className="sd-input mono"
          defaultValue={defaultText(column.default)}
          list={suggestions.length ? listId : undefined}
          disabled={readOnly}
          spellCheck={false}
          placeholder={suggestions.length ? `e.g. ${suggestions[0]}` : 'none'}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          onBlur={(e) => {
            const next = parseDefault(e.target.value);
            if (defaultText(next) !== defaultText(column.default)) set({ default: next });
          }}
        />
        {suggestions.length > 0 && (
          <datalist id={listId}>
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
      </label>

      {(INTEGER.test(column.type.name) || column.increment) && (
        <label className="sd-col-detail toggle" title="Auto-increment — The database numbers new rows 1, 2, 3… so inserts leave this column out">
          <span>Auto-increment</span>
          <input type="checkbox" checked={column.increment} disabled={readOnly} onChange={(e) => set({ increment: e.target.checked })} />
        </label>
      )}

      <div className="sd-col-detail">
        <span title="References — Makes this column a foreign key: each value must exist in the column you pick">References</span>
        <div className="sd-col-ref">
          <PickList
            label={`${column.name} references`}
            value={currentValue}
            disabled={readOnly}
            mono
            intro={`Makes ${column.name} a foreign key: every value must exist in the column you pick. Keys and unique columns are listed.`}
            options={[
              { value: '', label: 'Nothing', about: 'Not a foreign key — any value is allowed' },
              ...(current && !known ? [{ value: currentValue, label: `${current.target.table}.${current.target.columns.join(',')}`, about: 'As written in the text' }] : []),
              ...targets.flatMap(({ table: t, columns }) =>
                columns.map((c) => ({
                  value: `${t.key}|${c.name}`,
                  label: `${shortKey(t.key)}.${c.name}`,
                  meta: typeText(c.type),
                  group: shortKey(t.key),
                  about: t.key === table.key && c.name === column.name ? 'This column itself' : `${c.pk ? 'Primary key' : 'Unique column'}${typeText(c.type) !== typeText(column.type) ? ` — its type differs from ${column.name}'s ${typeText(column.type)}` : ''}`,
                  disabled: t.key === table.key && c.name === column.name,
                })),
              ),
            ]}
            onChange={(value) => setRef(value)}
          />
          {current && (
            <PickList
              label="Relation kind"
              value={current.op}
              disabled={readOnly}
              intro={KIND_INTRO}
              options={kindOptions({ table: table.key, columns: [column.name] }, { table: refKey(current.target), columns: current.target.columns })}
              onChange={(op) => setRef(currentValue, op)}
            />
          )}
        </div>
      </div>
      {hasRefLine && <p className="sd-field-about">Also linked by a Ref line in the text — change that one under Relations.</p>}

      <label className="sd-col-detail" title="Note — Shown with the column on hover and exported as a comment">
        <span>Note</span>
        <input
          key={column.note || ''}
          className="sd-input"
          defaultValue={column.note || ''}
          disabled={readOnly}
          placeholder="Why this column exists"
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          onBlur={(e) => {
            const next = e.target.value.trim() || null;
            if (next !== (column.note || null)) set({ note: next });
          }}
        />
      </label>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function AddColumn({ table, model, inputRef }) {
  const schema = useEditor().schema;
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [typeTouched, setTypeTouched] = useState(false);
  const [linkRef, setLinkRef] = useState(true);
  const trimmed = name.trim();
  // A space means a whole DBML line ("email varchar(255) [not null]"), added as written.
  const rawLine = /\s/.test(trimmed);
  const guess = useMemo(() => guessColumn(model, table.key, trimmed), [model, table.key, trimmed]);
  const shownType = typeTouched ? type : guess.type;
  const exists = !rawLine && table.columns.some((c) => c.name === trimmed);
  const ready = trimmed && !exists && (rawLine || validTypeText(shownType));

  const submit = (event) => {
    event.preventDefault();
    if (!ready) return;
    const line = rawLine ? trimmed : buildColumnLine(trimmed, shownType.trim(), { settings: typeTouched ? [] : guess.settings, ref: linkRef ? guess.ref : null });
    schema.addColumn(table.key, line);
    setName('');
    setType('');
    setTypeTouched(false);
    setLinkRef(true);
    inputRef.current?.focus();
  };

  const extras = [...(typeTouched ? [] : guess.settings), ...(guess.ref && linkRef ? [`ref: > ${shortKey(guess.ref.table)}.${guess.ref.column}`] : [])];

  return (
    <form className="sd-cols-add" onSubmit={submit}>
      <div className="sd-cols-add-row">
        <input
          ref={inputRef}
          className="sd-input mono"
          value={name}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
          placeholder="new_column"
          aria-label="New column name"
          title="New column — Type a name and press Enter; the type is guessed from the name (user_id links to users). A whole DBML line works too"
        />
        {!rawLine && (
          <TypeInput
            value={shownType}
            model={model}
            label="New column type"
            onChange={(text) => {
              setType(text);
              setTypeTouched(true);
            }}
            onCommit={(text) => {
              setType(text);
              setTypeTouched(true);
            }}
          />
        )}
        <button type="submit" className="btn ghost sm" disabled={!ready} title={exists ? `${table.name} already has a column named ${trimmed}` : 'Add column (Enter)'}>
          Add
        </button>
      </div>
      {trimmed && !rawLine && (guess.ref || extras.length > 0) && (
        <div className="sd-cols-add-hint">
          {guess.ref ? (
            <label title="Reference — Adds ref: > so every value must exist in that table">
              <input type="checkbox" checked={linkRef} onChange={(e) => setLinkRef(e.target.checked)} /> references <b className="mono">{`${shortKey(guess.ref.table)}.${guess.ref.column}`}</b>
            </label>
          ) : null}
          {!guess.ref && extras.length > 0 && <span className="mono">[{extras.join(', ')}]</span>}
        </div>
      )}
      {rawLine && <div className="sd-cols-add-hint">Adds the line as written: name, type, [settings]</div>}
    </form>
  );
}

function QuickAdd({ table, model }) {
  const schema = useEditor().schema;
  const names = new Set(table.columns.map((c) => c.name));
  return (
    <div className="sd-quick">
      <div className="sd-chips" role="group" aria-label="Quick add columns">
        {columnPresets(model).map((preset) => {
          const missing = preset.lines.filter((line) => !names.has(lineColumnName(line)));
          return (
            <button
              key={preset.id}
              type="button"
              className="sd-chip mono"
              disabled={!missing.length}
              title={missing.length ? `${preset.about} — ${missing.join('\n')}` : `${preset.label} — Already in ${table.name}`}
              onClick={() => schema.addColumns(table.key, missing)}
            >
              + {preset.label}
            </button>
          );
        })}
      </div>
      {model.tables.length > 0 && (
        <PickList
          label="Link to table"
          value={null}
          display="+ Link to table…"
          className="sd-picklist-action"
          title="Link to table — Adds a foreign key column pointing at another table's primary key, e.g. user_id → users.id"
          intro={`Adds a foreign key column to ${table.name}: each value must be the key of a row in the table you pick, and many ${table.name} rows can point to the same one — like orders.user_id → users.id.`}
          options={model.tables.map((t) => {
            const pk = primaryKeyOf(t);
            const fk = pk && foreignKeyColumn(table, t);
            const self = t.key === table.key;
            return {
              value: t.key,
              label: shortKey(t.key),
              meta: `${t.columns.length} column${t.columns.length === 1 ? '' : 's'}`,
              about: !fk
                ? `Can't link yet: ${t.name} needs a single-column primary key`
                : self
                  ? `Points a row at another ${t.name} row (a parent, a manager) — adds ${fk.name}`
                  : `Adds ${fk.name} ${typeText(pk.type)} → ${t.name}.${pk.name}`,
              disabled: !fk,
            };
          })}
          onChange={(key) => {
            const target = model.byKey.get(key);
            const fk = target && foreignKeyColumn(table, target);
            if (fk) schema.addColumn(table.key, fk.line);
          }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function RelationRow({ relation, readOnly }) {
  const editor = useEditor();
  const schema = editor.schema;
  const from = `${shortKey(relation.from.table)}.${relation.from.columns.join(', ')}`;
  const to = `${shortKey(relation.to.table)}.${relation.to.columns.join(', ')}`;
  return (
    <div className="sd-relation-row">
      <div className="sd-relation-ends mono" title={`${relation.name ? `${relation.name} — ` : `${from} → ${to} — `}${opAbout(relation.op)}`}>
        <span>{from}</span>
        <span className="sd-relation-arrow" aria-hidden="true">
          →
        </span>
        <span>{to}</span>
      </div>
      <div className="sd-relation-controls">
        <PickList label="Relation kind" value={relation.op} disabled={readOnly} intro={KIND_INTRO} options={kindOptions(relation.from, relation.to)} onChange={(op) => schema.setRelationOp(relation, op)} />
        <button
          type="button"
          className="sd-icon-btn sm"
          disabled={readOnly}
          aria-label="Delete relation"
          title="Delete relation — Removes the link; both columns stay. Asks first"
          onClick={() => askToDelete(editor, relationDeletionSummary(relation), 'Delete relation', () => schema.removeRelation(relation))}
        >
          ×
        </button>
      </div>
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
      <p className="sd-field-about">{opAbout(relation.op)}</p>
      {(relation.onDelete || relation.onUpdate) && (
        <p className="sd-field-about">
          {relation.onDelete && `on delete ${relation.onDelete}`} {relation.onUpdate && `on update ${relation.onUpdate}`}
        </p>
      )}
    </section>
  );
}
