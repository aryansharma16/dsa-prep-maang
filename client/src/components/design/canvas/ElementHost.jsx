import { memo } from 'react';
import { shapeFor } from '../../../design/shapes/registry.js';
import { useChildIds, useElement, useUi, useVisibleIds } from './hooks.js';
import { ConnectorView } from '../shapes/ConnectorView.jsx';
import { VIEWS, UnknownView } from '../shapes/views.jsx';

/**
 * One element on the board: a positioned box, and the view for its type inside.
 *
 * Memoised on its id and subscribed to its own record, so it re-renders only
 * when that element changes. Frames render their children inside themselves,
 * which is what makes child coordinates relative and gives a frame's clipping
 * for free.
 */

export const ElementList = memo(function ElementList({ parent }) {
  const ids = useChildIds(parent);
  const visible = useVisibleIds();
  // Off-screen elements on a big board are not mounted at all.
  return (visible ? ids.filter((id) => visible.has(id)) : ids).map((id) => <ElementHost key={id} id={id} />);
});

export const ElementHost = memo(function ElementHost({ id }) {
  const record = useElement(id);
  const editing = useUi((s) => s.editingId === id);
  const erasing = useUi((s) => s.erasing.includes(id));
  const dropTarget = useUi((s) => s.dropTarget === id);
  if (!record) return null;

  if (record.type === 'connector') return <ConnectorView record={record} erasing={erasing} />;

  const { data } = record;
  const View = VIEWS[record.type] || UnknownView;
  const known = shapeFor(record.type).type !== 'unknown';
  const rot = data.rot ? ` rotate(${data.rot}rad)` : '';

  return (
    <div
      className={`sd-el sd-el-${known ? record.type : 'unknown'} ${editing ? 'is-editing' : ''} ${erasing ? 'is-erasing' : ''} ${dropTarget ? 'is-drop-target' : ''} ${data.locked ? 'is-locked' : ''}`}
      data-hue={data.color}
      style={{
        transform: `translate(${data.x || 0}px, ${data.y || 0}px)${rot}`,
        width: data.w || 0,
        height: data.h || 0,
        opacity: data.opacity ?? undefined,
      }}
    >
      <View record={record} editing={editing} />
      {record.type === 'frame' && (
        <div className={`sd-frame-children ${data.clip ? 'clip' : ''}`}>
          <ElementList parent={record.id} />
        </div>
      )}
    </div>
  );
});
