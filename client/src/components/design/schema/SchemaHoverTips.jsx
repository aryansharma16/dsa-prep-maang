import { useEffect } from 'react';
import { defaultText, describeType, RELATION_KINDS, typeText } from '../../../design/schema/assist.js';
import { SCHEMA_METRICS } from '../../../design/schema/layout.js';
import { useEditor } from '../canvas/hooks.js';
import { useTip } from '../ui/Tooltips.jsx';

/**
 * What the pointer is resting on in a schema diagram, said in words: a column
 * (its type and what that type is for, keys, default, what it references and
 * what references it, its note), a table header, or a relation line ("many
 * orders → one user").
 *
 * Elements on the canvas take no pointer events (the editor hit-tests), so this
 * listens on the viewport and asks the editor what is under the pointer. It
 * stays quiet while a button is down, a tool other than Select or Hand is
 * active, or text is being edited.
 */

const shortKey = (key) => key.replace(/^public\./, '');
const side = (end) => `${shortKey(end.table)}.${end.columns.join(', ')}`;

function columnTip(model, table, column) {
  const type = typeText(column.type);
  const flags = [
    column.pk && 'primary key',
    column.increment && 'auto-increment',
    !column.pk && column.notNull && 'required',
    !column.pk && column.unique && 'unique',
    column.default && `default ${defaultText(column.default)}`,
  ].filter(Boolean);
  const outgoing = model.relations.filter((r) => r.from.table === table.key && r.from.columns.includes(column.name));
  const incoming = model.relations.filter((r) => r.to.table === table.key && r.to.columns.includes(column.name));
  return {
    title: column.name,
    meta: type,
    body: [
      describeType(type, model),
      flags.length ? flags.join(' · ').replace(/^./, (c) => c.toUpperCase()) : null,
      ...outgoing.map((r) => `References ${side(r.to)}`),
      incoming.length ? `Referenced by ${incoming.map((r) => side(r.from)).join(', ')}` : null,
      column.note,
    ],
  };
}

function relationTip(relation) {
  const op = RELATION_KINDS.find((o) => o.value === relation.op);
  return {
    title: `${side(relation.from)} → ${side(relation.to)}`,
    meta: op?.label,
    body: [op?.about, relation.onDelete && `On delete: ${relation.onDelete}`, relation.onUpdate && `On update: ${relation.onUpdate}`, 'Click to select it and change its kind'],
  };
}

export function SchemaHoverTips() {
  const editor = useEditor();
  const { schedule, hide, element } = useTip();

  useEffect(() => {
    const viewport = editor.dom?.viewport;
    if (!viewport || !editor.schema) return undefined;
    const m = SCHEMA_METRICS;
    let frame = 0;
    let last = null;

    const toClient = (x, y) => {
      const r = viewport.getBoundingClientRect();
      const { x: cx, y: cy, z } = editor.camera;
      return { left: r.left + x * z + cx, top: r.top + y * z + cy, z };
    };

    const update = () => {
      frame = 0;
      const event = last;
      const { tool, editingId, interaction } = editor.ui.get();
      if (!event || (tool !== 'select' && tool !== 'hand') || editingId || (interaction && interaction !== 'idle')) return schedule(null);
      const world = editor.clientToWorld(event.clientX, event.clientY);
      const model = editor.schema.getModel();
      const hit = editor.hitTest(world.x, world.y);
      const record = hit ? editor.store.get(hit) : null;

      if (record?.type === 'dbtable') {
        const table = model.byKey.get(record.data.name);
        if (!table) return schedule(null);
        const box = editor.worldBox(record);
        const offset = world.y - box.y;
        if (offset < m.headerH) {
          return schedule(`head:${table.key}`, () => {
            const at = toClient(box.x, box.y);
            return {
              rect: { left: at.left, top: at.top, width: box.w * at.z, height: m.headerH * at.z },
              tip: {
                title: shortKey(table.key),
                meta: `${table.columns.length} column${table.columns.length === 1 ? '' : 's'}`,
                body: [table.note, 'Double-click to open its DBML · drag to move'],
              },
            };
          });
        }
        const index = Math.floor((offset - m.headerH) / m.rowH);
        const column = table.columns[index];
        if (!column) return schedule(null);
        return schedule(`col:${table.key}.${column.name}`, () => {
          const at = toClient(box.x, box.y + m.headerH + index * m.rowH);
          return { rect: { left: at.left, top: at.top, width: box.w * at.z, height: m.rowH * at.z }, tip: columnTip(editor.schema.getModel(), table, column) };
        });
      }

      if (!record) {
        const relation = editor.schema.relationAt(world.x, world.y, 6 / editor.camera.z);
        if (relation) {
          const { clientX, clientY } = event;
          return schedule(`rel:${relation.id}`, () => ({ rect: { left: clientX - 6, top: clientY - 6, width: 12, height: 12 }, tip: relationTip(relation) }));
        }
      }
      return schedule(null);
    };

    const onMove = (event) => {
      if (event.buttons || event.pointerType === 'touch') {
        last = null;
        hide();
        return;
      }
      last = event;
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onLeave = () => {
      last = null;
      hide();
    };

    viewport.addEventListener('pointermove', onMove);
    viewport.addEventListener('pointerleave', onLeave);
    viewport.addEventListener('pointerdown', onLeave);
    viewport.addEventListener('wheel', onLeave, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener('pointermove', onMove);
      viewport.removeEventListener('pointerleave', onLeave);
      viewport.removeEventListener('pointerdown', onLeave);
      viewport.removeEventListener('wheel', onLeave);
    };
  }, [editor, schedule, hide]);

  return element;
}
