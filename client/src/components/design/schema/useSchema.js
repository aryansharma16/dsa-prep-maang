import { useCallback, useSyncExternalStore } from 'react';
import { useEditor } from '../canvas/hooks.js';

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
