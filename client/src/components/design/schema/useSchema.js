import { useCallback, useSyncExternalStore } from 'react';
import { relationHighlight } from '../../../design/schema/layout.js';
import { useEditor, useUi } from '../canvas/hooks.js';

const EMPTY = { tables: [], byKey: new Map(), relations: [], enums: new Map(), groups: [], notes: [], diagnostics: [] };
const noop = () => () => {};

/**
 * The analyzed schema of the open board (design/schema/schemaSync.js).
 *
 * The one place a view reads more than its own record: a table's columns live
 * in the board's DBML text, which is a record too — this is that record, parsed
 * once for everyone rather than once per table.
 */
export function useSchemaModel() {
  const editor = useEditor();
  const schema = editor.schema;
  const subscribe = useCallback((fn) => (schema ? schema.subscribe(fn) : noop()), [schema]);
  return useSyncExternalStore(subscribe, () => (schema ? schema.getModel() : EMPTY));
}

export function useSchemaText() {
  const editor = useEditor();
  const schema = editor.schema;
  const subscribe = useCallback((fn) => (schema ? schema.subscribe(fn) : noop()), [schema]);
  return useSyncExternalStore(subscribe, () => (schema ? schema.getText() : ''));
}

const NONE = { relations: new Set(), tables: new Map(), dim: false };
let cached = { key: null, value: NONE };

/**
 * What to light up on the diagram: the selected tables (or relation line), else
 * the hovered table — plus the table under the DBML caret — with their relations
 * and the columns those join (layout.js `relationHighlight`). `dim` is set when
 * it comes from a selection, so the other lines fade back.
 *
 * Worked out once per UI or schema change and shared, since every table reads it.
 */
export function schemaHighlight(editor, model, ui) {
  const inputs = [editor, model, ui.selection, ui.hovered, ui.schemaRelation, ui.schemaFocus?.table ?? null];
  if (cached.key && cached.key.every((v, i) => v === inputs[i])) return cached.value;
  const tableName = (id) => {
    const record = editor.store.get(id);
    return record?.type === 'dbtable' ? record.data.name : null;
  };
  const selected = ui.selection.map(tableName).filter(Boolean);
  const active = new Set(selected);
  if (!selected.length && !ui.schemaRelation && ui.hovered) {
    const name = tableName(ui.hovered);
    if (name) active.add(name);
  }
  if (ui.schemaFocus?.table) active.add(ui.schemaFocus.table);
  const value = active.size || ui.schemaRelation ? { ...relationHighlight(model, active, ui.schemaRelation), dim: Boolean(selected.length || ui.schemaRelation) } : NONE;
  cached = { key: inputs, value };
  return value;
}

export function useSchemaHighlight() {
  const editor = useEditor();
  const model = useSchemaModel();
  return useUi((ui) => schemaHighlight(editor, model, ui));
}
