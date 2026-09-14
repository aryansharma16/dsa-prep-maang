import { analyzeDbml, tableKey } from './analyze.js';
import * as edits from './edits.js';
import { distToPolyline } from '../core/geometry.js';
import { autoArrange, relationEnds, relationPath, tableSize } from './layout.js';
import { freeSpot, placeNewTables, reconcileTables } from './reconcile.js';
import { sqlToDbml } from './sqlImport.js';

/**
 * A schema board's live model: the DBML text, what it means, and the table
 * positions kept in step with it.
 *
 * The text is an ordinary store record (`SOURCE_ID`, parented under
 * `META_PARENT` so nothing draws, orders or hit-tests it). That is what gives
 * typing, diagram edits and undo one history, and lets autosave, the tab lock
 * and remote changes carry the text like any element — diff.js turns changes to
 * it into the server's compare-and-set `source` op.
 *
 * Tables on the diagram are `dbtable` elements (`data.name` = qualified table
 * key, plus position and size). Their creation, renaming and removal follow the
 * text through reconcile.js; those writes are saved but kept out of undo, since
 * undoing the text brings them back into line by itself.
 *
 * Diagram actions — rename a table, delete it, add a column or a relation —
 * are text edits (edits.js) committed together with any position change, so
 * one undo takes back both.
 */

export const SOURCE_ID = '__source';
export const META_PARENT = '__meta';
export const sourceRecord = (text, rev = 0) => ({ id: SOURCE_ID, type: 'dbsource', parent: META_PARENT, z: 'a0', data: { text: text ?? '' }, rev });

export function createSchemaSync(editor) {
  const { store, ui } = editor;
  let text = store.get(SOURCE_ID)?.data.text ?? '';
  let model = analyzeDbml(text);
  let pending = { added: new Map(), removed: new Map() };
  const lastPositions = new Map(); // table key → last { x, y }, so a table cut and restored comes back where it was
  const knownColumns = new Map(); // element id → column names last seen, for pairing renames
  const listeners = new Set();
  let wakeTimer = 0;
  let version = 0;
  let disposed = false;

  const tables = () => [...store.all()].filter((r) => r.type === 'dbtable');
  const emit = () => {
    version += 1;
    for (const fn of listeners) fn();
  };

  /** Parses the text; while it has errors, tables that vanished keep their last good version. */
  function reparse() {
    const next = analyzeDbml(text);
    if (next.diagnostics.some((d) => d.severity === 'error')) {
      for (const table of model.tables) {
        if (next.byKey.has(table.key)) continue;
        const stale = { ...table, stale: true };
        next.tables.push(stale);
        next.byKey.set(table.key, stale);
      }
    }
    model = next;
    emit();
  }

  function reconcile() {
    clearTimeout(wakeTimer);
    wakeTimer = 0;
    // Only a tab that may edit writes positions; read-only tabs follow what it saves.
    if (disposed || ui.get().readOnly) return;
    const sizes = new Map(model.tables.map((t) => [t.key, tableSize(t)]));
    let elements = tables();

    // Two devices creating the same new table at once converge on the smallest id.
    const byName = new Map();
    const duplicates = [];
    for (const element of [...elements].sort((a, b) => (a.id < b.id ? -1 : 1))) {
      if (byName.has(element.data.name)) duplicates.push(element.id);
      else byName.set(element.data.name, element);
    }
    if (duplicates.length) elements = elements.filter((e) => !duplicates.includes(e.id));

    const result = reconcileTables(
      model,
      elements.map((e) => ({ id: e.id, table: e.data.name, columns: knownColumns.get(e.id) })),
      pending,
      Date.now(),
    );
    pending = result.pending;

    const renamed = new Map(result.rename.map((r) => [r.id, r.table]));
    const removed = new Set(result.remove);
    const needsSize = elements.filter((e) => {
      const size = sizes.get(renamed.get(e.id) || e.data.name);
      return size && !removed.has(e.id) && (e.data.w !== size.w || e.data.h !== size.h);
    });
    if (duplicates.length || result.rename.length || result.remove.length || result.create.length || needsSize.length) {
      store.transact(
        (tx) => {
          for (const id of duplicates) tx.remove(id);
          for (const [id, name] of renamed) tx.update(id, { data: { name } });
          for (const id of removed) {
            const record = tx.get(id);
            if (!record) continue;
            lastPositions.set(record.data.name, { x: record.data.x, y: record.data.y });
            tx.remove(id);
          }
          if (result.create.length) {
            const kept = elements.filter((e) => !removed.has(e.id));
            const positions = new Map(kept.map((e) => [renamed.get(e.id) || e.data.name, { x: e.data.x || 0, y: e.data.y || 0 }]));
            const fresh = result.create.filter((key) => !lastPositions.has(key));
            let placed;
            if (!positions.size && fresh.length > 1) {
              const subset = { ...model, tables: model.tables.filter((t) => fresh.includes(t.key)) };
              placed = autoArrange(subset, sizes);
            } else {
              placed = placeNewTables(model, positions, sizes, fresh);
            }
            for (const key of result.create) {
              const at = lastPositions.get(key) || placed.get(key) || { x: 0, y: 0 };
              const size = sizes.get(key);
              const record = editor.newRecord('dbtable', { name: key, x: Math.round(at.x), y: Math.round(at.y), w: size.w, h: size.h }, { parent: null, tx });
              tx.create(record);
            }
          }
          for (const element of needsSize) {
            const size = sizes.get(renamed.get(element.id) || element.data.name);
            if (tx.get(element.id)) tx.update(element.id, { data: { w: size.w, h: size.h } });
          }
        },
        { label: 'Sync tables', history: false },
      );
      if (!elements.length && result.create.length && typeof requestAnimationFrame !== 'undefined') queueMicrotask(() => editor.zoomToFit?.());
    }
    for (const element of tables()) {
      const table = model.byKey.get(element.data.name);
      if (table) knownColumns.set(element.id, table.columns.map((c) => c.name));
    }
    if (result.wakeIn) wakeTimer = setTimeout(reconcile, result.wakeIn);
  }

  const offChange = store.onChange((changes) => {
    if (!changes.has(SOURCE_ID)) return;
    const next = store.get(SOURCE_ID)?.data.text ?? '';
    if (next === text) return;
    text = next;
    reparse();
    reconcile();
  });

  /** One undoable commit: the new text, plus any element changes made alongside it. */
  function commitText(label, nextText, extra, options) {
    if (nextText === text && !extra) return false;
    return editor.commit(
      label,
      (tx) => {
        if (nextText !== text) tx.update(SOURCE_ID, { data: { text: nextText } });
        extra?.(tx);
      },
      options,
    );
  }

  const keyFor = (name, like) => {
    const schema = like?.split('.')[0];
    return tableKey(schema && schema !== 'public' ? schema : null, name);
  };

  const api = {
    getModel: () => model,
    getText: () => text,
    getVersion: () => version,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /** Typing in the editor: runs of keystrokes merge into one undo step. */
    setText(next) {
      return commitText('Edit schema', next, null, { mergeKey: 'schema-typing' });
    },

    renameTable(key, newName) {
      const name = String(newName ?? '').trim();
      if (!name) return false;
      const next = edits.renameTable(text, key, name);
      if (next === text) return false;
      const newKey = keyFor(name, key);
      return commitText('Rename table', next, (tx) => {
        for (const element of tables()) if (element.data.name === key) tx.update(element.id, { data: { name: newKey } });
      });
    },

    /** Deletes several tables as one step (the board's Delete key). */
    deleteTables(keys) {
      let next = text;
      for (const key of keys) next = edits.removeTable(next, key);
      const set = new Set(keys);
      return commitText(keys.length === 1 ? 'Delete table' : 'Delete tables', next, (tx) => {
        for (const element of tables()) if (set.has(element.data.name)) tx.remove(element.id);
      });
    },

    /** The relation whose line passes within `tolerance` of a world point, or null. */
    relationAt(wx, wy, tolerance = 6) {
      const boxes = new Map(tables().map((r) => [r.data.name, { x: r.data.x || 0, y: r.data.y || 0, w: r.data.w || 180, h: r.data.h || 64 }]));
      let best = null;
      for (const relation of model.relations) {
        const fromTable = model.byKey.get(relation.from.table);
        const toTable = model.byKey.get(relation.to.table);
        const fromBox = boxes.get(relation.from.table);
        const toBox = boxes.get(relation.to.table);
        if (!fromTable || !toTable || !fromBox || !toBox) continue;
        const ends = relationEnds(relation, fromTable, fromBox, toTable, toBox);
        const d = distToPolyline(wx, wy, relationPath(ends.from, ends.to));
        if (d <= tolerance && (!best || d < best.d)) best = { relation, d };
      }
      return best?.relation || null;
    },

    deleteTable(key) {
      const next = edits.removeTable(text, key);
      return commitText('Delete table', next, (tx) => {
        for (const element of tables()) if (element.data.name === key) tx.remove(element.id);
      });
    },

    /** A new table at a world point (the middle of the view by default), placed straight away. */
    addTable(at) {
      const taken = new Set(model.tables.map((t) => t.name));
      let n = model.tables.length + 1;
      while (taken.has(`table_${n}`)) n += 1;
      const name = `table_${n}`;
      const next = edits.addTable(text, name);
      const key = tableKey(null, name);
      const table = { name, schema: null, columns: [{ name: 'id', type: { name: 'bigint', args: null, array: false } }] };
      const size = tableSize(table);
      const view = editor.visibleWorld();
      const point = at || { x: (view.minX + view.maxX) / 2, y: (view.minY + view.maxY) / 2 };
      const corner = { x: Math.round(point.x - size.w / 2), y: Math.round(point.y - size.h / 2) };
      // A double-click puts it where you clicked; the button finds room near the middle of the view.
      const spot = at ? corner : freeSpot(tables().map((r) => ({ x: r.data.x || 0, y: r.data.y || 0, w: r.data.w || 180, h: r.data.h || 64 })), size, corner);
      let id = null;
      commitText('Add table', next, (tx) => {
        const record = editor.newRecord('dbtable', { name: key, x: spot.x, y: spot.y, w: size.w, h: size.h }, { parent: null, tx });
        tx.create(record);
        id = record.id;
      });
      if (id) {
        editor.select([id]);
        ui.set({ schemaNewTable: key });
      }
      return key;
    },

    /** `merge` folds a run of changes (dragging in a colour picker) into one undo step. */
    setTableColor: (key, color, merge = false) => commitText('Table colour', edits.setTableColor(text, key, color), null, merge ? { mergeKey: `table-color:${key}` } : undefined),
    addColumn: (key, line) => commitText('Add column', edits.addColumn(text, key, line)),
    /** Several column lines as one undo step (the inspector's "timestamps" adds two). */
    addColumns: (key, lines) => commitText(lines.length === 1 ? 'Add column' : 'Add columns', lines.reduce((src, line) => edits.addColumn(src, key, line), text)),
    replaceColumn: (key, column, line) => commitText('Edit column', edits.replaceColumn(text, key, column, line)),
    removeColumn: (key, column) => commitText('Delete column', edits.removeColumn(text, key, column)),
    renameColumn: (key, column, name) => commitText('Rename column', edits.renameColumn(text, key, column, name)),
    addRelation: (from, to, op = '>') => commitText('Add relation', edits.addRelation(text, from, to, op)),
    removeRelation: (relation) => commitText('Delete relation', edits.removeRelation(text, relation)),
    setRelationOp: (relation, op) => commitText('Change relation', edits.setRelationOp(text, relation, op)),

    /** Lays every table out again. One undo step; positions only. */
    autoArrange() {
      const sizes = new Map(model.tables.map((t) => [t.key, tableSize(t)]));
      const positions = autoArrange(model, sizes);
      const els = tables();
      if (!els.length) return false;
      const origin = els.reduce((m, e) => ({ x: Math.min(m.x, e.data.x || 0), y: Math.min(m.y, e.data.y || 0) }), { x: Infinity, y: Infinity });
      return editor.commit('Auto-arrange', (tx) => {
        for (const element of els) {
          const p = positions.get(element.data.name);
          if (p) tx.update(element.id, { data: { x: Math.round(origin.x + p.x), y: Math.round(origin.y + p.y) } });
        }
      });
    },

    /** Adds a block of DBML after what is there (the example schema), as one undo step. */
    appendText(label, block) {
      return commitText(label, text.trim() ? `${text.replace(/\s*$/, '')}\n\n${block}` : block);
    },

    /** SQL DDL in; `replace` swaps the whole text, otherwise it is appended. Returns the importer's warnings. */
    importSql(sql, { replace = false } = {}) {
      const { dbml, warnings } = sqlToDbml(sql);
      if (!dbml.trim()) return { warnings: warnings.length ? warnings : ['No CREATE TABLE statements found'], imported: false };
      const next = replace || !text.trim() ? dbml : `${text.replace(/\s*$/, '')}\n\n${dbml}`;
      commitText('Import SQL', next);
      return { warnings, imported: true };
    },

    dispose() {
      disposed = true;
      clearTimeout(wakeTimer);
      offChange?.();
      listeners.clear();
    },
  };

  // The text as loaded may already need positions (a board created with text, an import on another device).
  queueMicrotask(() => {
    if (!disposed) reconcile();
  });
  return api;
}
