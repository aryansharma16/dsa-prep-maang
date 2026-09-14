import { memo, useMemo } from 'react';
import { relationEnds, relationPath } from '../../../design/schema/layout.js';
import { capPath } from '../shapes/ConnectorView.jsx';
import { useEditor, useStoreValue, useUi } from '../canvas/hooks.js';
import { useSchemaHighlight, useSchemaModel } from './useSchema.js';

/**
 * The relations of a schema board, drawn from the text and the table positions —
 * never stored, so there is nothing to keep in sync.
 *
 * Each end carries crow's-foot notation: a fan for "many", a bar for "exactly
 * one", a ring and bar for "zero or one" (a nullable foreign key). One SVG in
 * the world layer, under the tables, so a line never covers a column name.
 *
 * Selecting a table (or hovering one) lights up its relations with dots running
 * from the referencing column to the referenced one, and fades the rest when it
 * is a selection — so in a crowded diagram you can see what a table touches.
 */

const endCap = (end) => (end.card === 'many' ? 'many' : end.optional ? 'zeroOrOne' : 'onlyOne');

export const SchemaRelations = memo(function SchemaRelations() {
  const editor = useEditor();
  const model = useSchemaModel();
  const selected = useUi((s) => s.schemaRelation);
  const highlight = useSchemaHighlight();
  // Re-derive when anything moves.
  const version = useStoreValue((e) => e.store.version);

  const lines = useMemo(() => {
    const boxes = new Map();
    for (const record of editor.store.all()) {
      if (record.type !== 'dbtable') continue;
      boxes.set(record.data.name, { x: record.data.x || 0, y: record.data.y || 0, w: record.data.w || 180, h: record.data.h || 64 });
    }
    const out = [];
    for (const relation of model.relations) {
      const fromTable = model.byKey.get(relation.from.table);
      const toTable = model.byKey.get(relation.to.table);
      const fromBox = boxes.get(relation.from.table);
      const toBox = boxes.get(relation.to.table);
      if (!fromTable || !toTable || !fromBox || !toBox) continue;
      const ends = relationEnds(relation, fromTable, fromBox, toTable, toBox);
      const points = relationPath(ends.from, ends.to);
      out.push({ relation, points, ends });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` is the store's change counter
  }, [editor, model, version]);

  if (!lines.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { points } of lines) {
    for (const [x, y] of points) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  // Lit relations paint last, over the faded ones.
  const ordered = highlight.relations.size ? [...lines.filter((l) => !highlight.relations.has(l.relation.id)), ...lines.filter((l) => highlight.relations.has(l.relation.id))] : lines;
  const pad = 40;
  const left = minX - pad;
  const top = minY - pad;

  return (
    <svg
      className={`sd-svg sd-relations ${highlight.dim ? 'dim' : ''}`}
      style={{ transform: `translate(${left}px, ${top}px)` }}
      width={maxX - minX + pad * 2}
      height={maxY - minY + pad * 2}
      aria-hidden="true"
    >
      {ordered.map(({ relation, points, ends }) => {
        const local = points.map(([x, y]) => [x - left, y - top]);
        const d = local.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
        const fromAngle = ends.from.side === 'right' ? Math.PI : 0;
        const toAngle = ends.to.side === 'right' ? Math.PI : 0;
        const startCap = capPath(endCap(relation.from), ends.from.x - left, ends.from.y - top, fromAngle, 12);
        const finishCap = capPath(endCap(relation.to), ends.to.x - left, ends.to.y - top, toAngle, 12);
        const involved = highlight.relations.has(relation.id);
        return (
          <g key={relation.id} className={`sd-relation ${selected === relation.id ? 'selected' : ''} ${involved ? 'involved' : ''}`}>
            <path d={d} className="sd-relation-line" />
            {involved && <path d={d} className="sd-relation-flow" />}
            {startCap && <path d={startCap.d} className="sd-relation-cap" />}
            {finishCap && <path d={finishCap.d} className="sd-relation-cap" />}
          </g>
        );
      })}
    </svg>
  );
});
