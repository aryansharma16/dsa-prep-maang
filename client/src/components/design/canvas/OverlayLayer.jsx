import { memo, useMemo } from 'react';
import { boxCorners, pointAlongPolyline } from '../../../design/core/geometry.js';
import { worldToScreen } from '../../../design/engine/camera.js';
import { SIDES, sidePoint } from '../../../design/engine/connectors/route.js';
import { handlePositions, selectionFrame, HANDLE_RADIUS } from '../../../design/engine/handles.js';
import { useCamera, useEditor, useStoreValue, useUi } from './hooks.js';

/**
 * Everything drawn *about* the board rather than *on* it: hover outlines, the
 * selection and its handles, the marquee, snap guides, where a drop or a
 * connector end would land — and what the selection is connected to: its
 * arrows lit with running dots, and the things at their other ends outlined
 * (the hovered thing's, when nothing is selected).
 *
 * In screen space, not world space, so a handle is 8px and a guide is 1px at
 * every zoom. It re-renders with the camera — which is cheap, because it only
 * ever holds a few dozen SVG nodes — and elements never re-render for any of it.
 */
export const OverlayLayer = memo(function OverlayLayer() {
  const editor = useEditor();
  const camera = useCamera();
  const hovered = useUi((s) => s.hovered);
  const selection = useUi((s) => s.selection);
  const marquee = useUi((s) => s.marquee);
  const snapLines = useUi((s) => s.snapLines);
  const dropTarget = useUi((s) => s.dropTarget);
  const bindTarget = useUi((s) => s.bindTarget);
  const interaction = useUi((s) => s.interaction);
  const editingId = useUi((s) => s.editingId);
  const readOnly = useUi((s) => s.readOnly);

  // Recomputed on any store change, so handles follow a drag.
  const version = useStoreValue((e) => e.store.version);
  const frame = useMemo(() => selectionFrame(editor), [editor, selection, version]); // eslint-disable-line react-hooks/exhaustive-deps

  // Arrows touching the selection (or the hovered thing), and what is at their other ends. Not per camera frame.
  const links = useMemo(() => {
    const active = new Set(selection.length ? selection : hovered && interaction === 'idle' ? [hovered] : []);
    if (!active.size) return null;
    const wires = [];
    const nodes = new Set();
    for (const record of editor.store.all()) {
      if (record.type !== 'connector') continue;
      const ends = [record.data.start?.eid, record.data.end?.eid];
      if (!active.has(record.id) && !ends.some((eid) => eid && active.has(eid))) continue;
      wires.push(record.id);
      for (const eid of ends) if (eid && !active.has(eid) && editor.store.has(eid)) nodes.add(eid);
    }
    return wires.length ? { wires, nodes: [...nodes], selected: selection.length > 0 } : null;
  }, [editor, selection, hovered, interaction, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const { width, height } = editor.viewportRect;
  const toScreen = (x, y) => worldToScreen(camera, x, y);

  const outline = (id, className) => {
    const record = editor.store.get(id);
    if (!record) return null;
    if (record.type === 'connector') {
      const geo = editor.connectorGeo(record);
      const d = geo.points.map(([x, y], i) => {
        const p = toScreen(x, y);
        return `${i ? 'L' : 'M'}${p.x},${p.y}`;
      });
      return <path key={`${className}-${id}`} d={d.join(' ')} className={className} />;
    }
    const box = editor.worldBox(record);
    const corners = boxCorners(box.x, box.y, box.w, box.h, box.rot).map((c) => toScreen(c.x, c.y));
    return <polygon key={`${className}-${id}`} points={corners.map((c) => `${c.x},${c.y}`).join(' ')} className={className} />;
  };

  const showHandles = frame && !readOnly && !editingId && interaction !== 'translating' && interaction !== 'brushing';

  return (
    <svg className="sd-overlay" width={width} height={height} aria-hidden="true">
      {links && interaction !== 'translating' && (
        <g className={`sd-links ${links.selected ? 'selected' : ''}`}>
          {links.wires.map((id) => outline(id, 'sd-link-wire'))}
          {links.wires.map((id) => outline(id, 'sd-link-flow'))}
          {links.nodes.map((id) => outline(id, 'sd-link-node'))}
        </g>
      )}

      {hovered && !selection.includes(hovered) && interaction === 'idle' && outline(hovered, 'sd-hover')}

      {dropTarget && outline(dropTarget, 'sd-drop')}

      {selection.length > 1 && selection.map((id) => outline(id, 'sd-selected-member'))}

      {frame && frame.kind !== 'connector' && !(editingId && frame.record?.id === editingId && ['structure', 'sqltable'].includes(frame.record.type)) && (
        <polygon
          className={`sd-selection ${frame.record?.data.locked ? 'locked' : ''}`}
          points={boxCorners(frame.box.x, frame.box.y, frame.box.w, frame.box.h, frame.box.rot)
            .map((c) => toScreen(c.x, c.y))
            .map((c) => `${c.x},${c.y}`)
            .join(' ')}
        />
      )}
      {frame?.kind === 'connector' && outline(frame.record.id, 'sd-selection-wire')}

      {showHandles &&
        handlePositions(frame, camera).map((h) =>
          h.edge ? null : frame.kind === 'connector' ? (
            <circle key={h.id} cx={h.x} cy={h.y} r={HANDLE_RADIUS + 0.5} className="sd-handle end" />
          ) : (
            <rect key={h.id} x={h.x - HANDLE_RADIUS} y={h.y - HANDLE_RADIUS} width={HANDLE_RADIUS * 2} height={HANDLE_RADIUS * 2} rx={2} className="sd-handle" />
          ),
        )}

      {frame?.kind === 'single' && frame.record && interaction === 'idle' && !editingId && (
        <SizeBadge frame={frame} camera={camera} />
      )}

      {bindTarget && <BindHints editor={editor} camera={camera} target={bindTarget} />}

      {marquee && (
        <rect
          className="sd-marquee"
          x={toScreen(marquee.minX, marquee.minY).x}
          y={toScreen(marquee.minX, marquee.minY).y}
          width={(marquee.maxX - marquee.minX) * camera.z}
          height={(marquee.maxY - marquee.minY) * camera.z}
        />
      )}

      {snapLines.map((line, i) => {
        const a = line.axis === 'x' ? toScreen(line.at, line.from) : toScreen(line.from, line.at);
        const b = line.axis === 'x' ? toScreen(line.at, line.to) : toScreen(line.to, line.at);
        // eslint-disable-next-line react/no-array-index-key -- guides have no identity
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="sd-snap" />;
      })}
    </svg>
  );
});

function SizeBadge({ frame, camera }) {
  const { box } = frame;
  if (box.rot) return null;
  const bottom = worldToScreen(camera, box.x + box.w / 2, box.y + box.h);
  if (box.w * camera.z < 40) return null;
  const text = `${Math.round(box.w)} × ${Math.round(box.h)}`;
  const width = text.length * 6.4 + 12;
  return (
    <g className="sd-size-badge" transform={`translate(${bottom.x - width / 2}, ${bottom.y + 10})`}>
      <rect width={width} height={18} rx={4} />
      <text x={width / 2} y={12.5} textAnchor="middle">
        {text}
      </text>
    </g>
  );
}

function BindHints({ editor, camera, target }) {
  const record = editor.store.get(target.eid);
  if (record?.type === 'connector') {
    // On a line: highlight it, and mark where the end will attach.
    const geo = editor.connectorGeo(record);
    const d = geo.points.map(([x, y], i) => {
      const p = worldToScreen(camera, x, y);
      return `${i ? 'L' : 'M'}${p.x},${p.y}`;
    });
    const at = pointAlongPolyline(geo.points, target.t ?? 0.5);
    const p = worldToScreen(camera, at.x, at.y);
    return (
      <g>
        <path className="sd-bind-line" d={d.join(' ')} />
        <circle cx={p.x} cy={p.y} r={5} className="sd-anchor on" />
      </g>
    );
  }
  const box = editor.worldBox(target.eid);
  if (!box) return null;
  const corners = boxCorners(box.x, box.y, box.w, box.h, box.rot).map((c) => worldToScreen(camera, c.x, c.y));
  return (
    <g>
      <polygon className="sd-bind-outline" points={corners.map((c) => `${c.x},${c.y}`).join(' ')} />
      {SIDES.map((side) => {
        const [x, y] = sidePoint(box, side);
        const p = worldToScreen(camera, x, y);
        return <circle key={side} cx={p.x} cy={p.y} r={target.anchor === side ? 5 : 3.5} className={`sd-anchor ${target.anchor === side ? 'on' : ''}`} />;
      })}
    </g>
  );
}
