import { memo, useMemo } from 'react';
import { pointAlongPolyline } from '../../../design/core/geometry.js';
import { STROKE_WIDTHS } from '../../../design/shapes/shapes.js';
import { useEditor, useGeometryVersion } from '../canvas/hooks.js';

/**
 * A connector: its path, its arrowheads, an optional label and — when turned
 * on — dots flowing along it to show traffic.
 *
 * Its geometry comes from the shapes it joins, so it subscribes to them (and to
 * the frames they sit in) as well as to its own record. It is drawn in its own
 * small SVG sized to its bounds, never a board-sized one, so a hundred arrows
 * are a hundred small layers rather than one enormous one.
 *
 * Arrowheads are paths of our own rather than SVG `<marker>`s, which scale with
 * the stroke in surprising ways, inherit colour inconsistently across browsers
 * and do not export cleanly.
 */

const CAP_SIZE = { s: 9, m: 11, l: 14 };

export function capPath(cap, x, y, angle, size) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const at = (dx, dy) => `${x + dx * cos - dy * sin},${y + dx * sin + dy * cos}`;
  const bar = (dx) => `M${at(dx, -size * 0.55)} L${at(dx, size * 0.55)}`;
  const fan = () => `M${at(-size * 0.9, 0)} L${at(0, -size * 0.6)} M${at(-size * 0.9, 0)} L${at(0, 0)} M${at(-size * 0.9, 0)} L${at(0, size * 0.6)}`;
  const ring = (dx) => {
    const r = Math.max(3.5, size * 0.38);
    const [cx, cy] = at(dx, 0).split(',').map(Number);
    return `M${cx - r},${cy} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 ${-r * 2},0`;
  };
  switch (cap) {
    case 'arrow':
      return { d: `M${at(-size, -size * 0.55)} L${at(0, 0)} L${at(-size, size * 0.55)}`, fill: false };
    case 'triangle':
      return { d: `M${at(0, 0)} L${at(-size, -size * 0.5)} L${at(-size, size * 0.5)} Z`, fill: true };
    case 'circle': {
      const r = size * 0.36;
      const c = at(-r, 0).split(',');
      return { d: `M${+c[0] - r},${c[1]} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 ${-r * 2},0`, fill: true };
    }
    case 'diamond':
      return { d: `M${at(0, 0)} L${at(-size * 0.5, -size * 0.4)} L${at(-size, 0)} L${at(-size * 0.5, size * 0.4)} Z`, fill: true };
    case 'bar':
      return { d: `M${at(0, -size * 0.55)} L${at(0, size * 0.55)}`, fill: false };
    // Crow's-foot ends: bars mean one, the fan means many, a ring means optional.
    case 'one':
      return { d: bar(-size * 0.55), fill: false };
    case 'onlyOne':
      return { d: `${bar(-size * 0.4)} ${bar(-size * 0.8)}`, fill: false };
    case 'zeroOrOne':
      return { d: `${bar(-size * 0.4)} ${ring(-size * 1.05)}`, fill: false };
    case 'many':
      return { d: fan(), fill: false };
    case 'oneOrMany':
      return { d: `${fan()} ${bar(-size * 1.15)}`, fill: false };
    case 'zeroOrMany':
      return { d: `${fan()} ${ring(-size * 1.4)}`, fill: false };
    default:
      return null;
  }
}

function roundedPath(points, radius = 10) {
  if (points.length < 3) return points.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const [px, py] = points[i - 1];
    const [cx, cy] = points[i];
    const [nx, ny] = points[i + 1];
    const inLen = Math.hypot(cx - px, cy - py);
    const outLen = Math.hypot(nx - cx, ny - cy);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const ax = cx - ((cx - px) / (inLen || 1)) * r;
    const ay = cy - ((cy - py) / (inLen || 1)) * r;
    const bx = cx + ((nx - cx) / (outLen || 1)) * r;
    const by = cy + ((ny - cy) / (outLen || 1)) * r;
    d += ` L${ax},${ay} Q${cx},${cy} ${bx},${by}`;
  }
  const last = points.at(-1);
  return `${d} L${last[0]},${last[1]}`;
}

function curvePath([p0, c1, c2, p1]) {
  return `M${p0[0]},${p0[1]} C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p1[0]},${p1[1]}`;
}

export const ConnectorView = memo(function ConnectorView({ record, erasing }) {
  const editor = useEditor();
  const { data } = record;
  // Recomputed every render, not memoised: an end on another connector depends on
  // that connector's own ends, which can change without this record changing. Any
  // such change bumps `version` and re-renders, and the hook resubscribes only when
  // the list itself differs.
  const ids = new Set(editor.geometryDeps(record));
  if (record.parent) {
    ids.add(record.parent);
    for (const a of editor.ancestors(record.parent)) ids.add(a);
  }
  const version = useGeometryVersion([...ids]);

  const geo = useMemo(() => editor.connectorGeo(record), [editor, record, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const origin = useMemo(() => editor.worldOrigin(record.parent), [editor, record.parent, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const width = STROKE_WIDTHS[data.strokeWidth] || 2;
  const capSize = CAP_SIZE[data.strokeWidth] || 11;
  const pad = capSize + 24;
  const b = geo.bounds;
  const left = b.minX - pad;
  const top = b.minY - pad;
  const w = b.maxX - b.minX + pad * 2;
  const h = b.maxY - b.minY + pad * 2;

  const local = geo.points.map(([x, y]) => [x - left, y - top]);
  const d = geo.curve ? curvePath(geo.curve.map(([x, y]) => [x - left, y - top])) : data.route === 'straight' ? roundedPath(local, 0) : roundedPath(local, 10);
  const startCap = capPath(data.startCap, geo.start.x - left, geo.start.y - top, geo.start.angle, capSize);
  const endCap = capPath(data.endCap ?? 'arrow', geo.end.x - left, geo.end.y - top, geo.end.angle, capSize);
  const dasharray = data.strokeStyle === 'dashed' ? `${width * 4} ${width * 3}` : data.strokeStyle === 'dotted' ? `0 ${width * 2.4}` : undefined;
  const flow = data.flow?.on;
  const label = data.label?.text;
  const labelAt = label ? pointAlongPolyline(geo.points, data.label.t ?? 0.5) : null;

  return (
    <div
      className={`sd-el sd-el-connector ${erasing ? 'is-erasing' : ''}`}
      data-hue={data.color || 'slate'}
      style={{ transform: `translate(${left - origin.x}px, ${top - origin.y}px)`, width: w, height: h, opacity: data.opacity ?? undefined }}
    >
      <svg className="sd-svg" width={w} height={h} aria-hidden="true">
        <path d={d} className="sd-wire" strokeWidth={width} strokeDasharray={dasharray} strokeLinecap={data.strokeStyle === 'dotted' ? 'round' : 'round'} />
        {flow && (
          <path
            d={d}
            className={`sd-flow speed-${data.flow.speed || 2} ${data.flow.reverse ? 'reverse' : ''}`}
            strokeWidth={Math.max(2.5, width * 1.6)}
          />
        )}
        {startCap && <path d={startCap.d} className={`sd-cap ${startCap.fill ? 'filled' : ''}`} strokeWidth={width} />}
        {endCap && <path d={endCap.d} className={`sd-cap ${endCap.fill ? 'filled' : ''}`} strokeWidth={width} />}
      </svg>
      {labelAt && (
        <div className="sd-wire-label" style={{ left: labelAt.x - left, top: labelAt.y - top }}>
          {label}
        </div>
      )}
    </div>
  );
});
