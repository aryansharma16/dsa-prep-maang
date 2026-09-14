import { memo, useMemo } from 'react';
import { outlineToPath, strokeOutline } from '../../../design/draw/freehand.js';
import { FONT_SIZES, PEN_SIZES, STROKE_WIDTHS } from '../../../design/shapes/shapes.js';
import { stickyFontSize } from '../../../design/text/measure.js';
import { ChatMarkdown } from '../../chat/ChatMarkdown.jsx';

/**
 * How each element type is drawn, given its record.
 *
 * Views are pure functions of the record (plus whether it is being edited) and
 * never read the editor. Shapes are SVG so their outlines are sharp at any zoom;
 * text is HTML so it wraps, selects and renders with the platform's text engine.
 * Colours come from CSS through `data-hue` on the host, so nothing here knows
 * about the theme.
 */

const dash = (style, width) => {
  if (style === 'dashed') return `${width * 4} ${width * 3}`;
  if (style === 'dotted') return `0 ${width * 2.4}`;
  return undefined;
};

function Label({ record, editing, pad = 10 }) {
  const { label, fontSize, align } = record.data;
  if (editing || !label) return null;
  return (
    <div className={`sd-label align-${align || 'center'} ${record.data.fillStyle === 'solid' ? 'on-solid' : ''}`} style={{ fontSize: FONT_SIZES[fontSize] || 14, padding: pad }}>
      <span>{label}</span>
    </div>
  );
}

export const BoxShapeView = memo(function BoxShapeView({ record, editing }) {
  const { type, data } = record;
  const w = Math.max(1, data.w || 1);
  const h = Math.max(1, data.h || 1);
  const sw = data.strokeStyle === 'none' ? 0 : STROKE_WIDTHS[data.strokeWidth] || 1;
  const inset = sw / 2;
  const common = {
    className: `sd-shape fill-${data.fillStyle || 'tint'}`,
    strokeWidth: sw,
    strokeDasharray: dash(data.strokeStyle, sw),
    strokeLinecap: data.strokeStyle === 'dotted' ? 'round' : 'butt',
  };

  let body;
  if (type === 'ellipse') {
    body = <ellipse cx={w / 2} cy={h / 2} rx={Math.max(0, w / 2 - inset)} ry={Math.max(0, h / 2 - inset)} {...common} />;
  } else if (type === 'diamond') {
    body = <polygon points={`${w / 2},${inset} ${w - inset},${h / 2} ${w / 2},${h - inset} ${inset},${h / 2}`} strokeLinejoin="round" {...common} />;
  } else if (type === 'cylinder') {
    const ry = Math.min(h * 0.16, w * 0.2, 20);
    const left = inset;
    const right = w - inset;
    const top = ry + inset;
    const bottom = h - ry - inset;
    body = (
      <>
        <path d={`M${left},${top} L${left},${bottom} A${w / 2 - inset},${ry} 0 0 0 ${right},${bottom} L${right},${top} A${w / 2 - inset},${ry} 0 0 0 ${left},${top} Z`} {...common} />
        <ellipse cx={w / 2} cy={top} rx={Math.max(0, w / 2 - inset)} ry={ry} {...common} className={`sd-shape sd-shape-rim fill-${data.fillStyle || 'tint'}`} />
      </>
    );
  } else {
    const radius = Math.min(data.radius ?? 10, w / 2, h / 2);
    body = <rect x={inset} y={inset} width={Math.max(0, w - sw)} height={Math.max(0, h - sw)} rx={radius} ry={radius} {...common} />;
  }

  return (
    <>
      <svg className="sd-svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`} overflow="visible" aria-hidden="true">
        {body}
      </svg>
      <Label record={record} editing={editing} pad={type === 'diamond' ? Math.min(w, h) * 0.2 : type === 'cylinder' ? 12 : 10} />
    </>
  );
});

export const FrameView = memo(function FrameView({ record, editing }) {
  const { data } = record;
  return (
    <>
      <div className={`sd-frame-body fill-${data.fillStyle || 'tint'}`} />
      {!editing && (
        <div className="sd-frame-title" title={data.name}>
          {data.name || 'Frame'}
        </div>
      )}
    </>
  );
});

export const TextView = memo(function TextView({ record, editing }) {
  const { data } = record;
  if (editing) return null;
  return (
    <div
      className={`sd-text-content align-${data.align || 'left'} ${data.weight === 'bold' ? 'bold' : ''} ${data.text ? '' : 'empty'}`}
      style={{ fontSize: FONT_SIZES[data.fontSize] || FONT_SIZES.l, whiteSpace: data.autoWidth ? 'pre' : 'pre-wrap' }}
    >
      {data.text || 'Text'}
    </div>
  );
});

export const ParagraphView = memo(function ParagraphView({ record, editing }) {
  const { data } = record;
  if (editing) return null;
  return (
    <div className={`sd-paragraph align-${data.align || 'left'}`} style={{ fontSize: FONT_SIZES[data.fontSize] || FONT_SIZES.m }}>
      {data.text ? <ChatMarkdown text={data.text} /> : <p className="sd-placeholder">Write notes, requirements, trade-offs… (markdown works)</p>}
    </div>
  );
});

export const StickyView = memo(function StickyView({ record, editing }) {
  const { data } = record;
  const size = useMemo(() => stickyFontSize(data.text, data.w, data.h), [data.text, data.w, data.h]);
  return (
    <div className={`sd-sticky sticky-${data.color || 'yellow'}`}>
      {!editing && (
        <div className={`sd-sticky-text align-${data.align || 'center'}`} style={{ fontSize: size }}>
          {data.text}
        </div>
      )}
    </div>
  );
});

export const StrokeView = memo(function StrokeView({ record }) {
  const { data } = record;
  const path = useMemo(() => {
    const flat = data.points || [];
    const points = [];
    for (let i = 0; i < flat.length; i += 3) points.push([flat[i], flat[i + 1], flat[i + 2]]);
    const size = PEN_SIZES[data.size] || 4;
    const highlighter = data.kind === 'highlighter';
    const outline = strokeOutline(points, {
      size: highlighter ? size * 3 : size,
      thinning: highlighter ? 0 : 0.55,
      streamline: 0.2,
      simulatePressure: data.simulate !== false,
      taperEnd: !highlighter,
    });
    return outlineToPath(outline);
  }, [data.points, data.size, data.kind, data.simulate]);

  return (
    <svg className="sd-svg" width={data.w} height={data.h} overflow="visible" aria-hidden="true">
      <path d={path} className={`sd-ink ${data.kind === 'highlighter' ? 'highlighter' : ''}`} />
    </svg>
  );
});

export function UnknownView() {
  return <div className="sd-unknown">Unsupported element</div>;
}

export const VIEWS = {
  rect: BoxShapeView,
  ellipse: BoxShapeView,
  diamond: BoxShapeView,
  cylinder: BoxShapeView,
  frame: FrameView,
  text: TextView,
  paragraph: ParagraphView,
  sticky: StickyView,
  stroke: StrokeView,
};
