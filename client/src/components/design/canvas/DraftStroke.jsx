import { useEffect, useRef } from 'react';
import { outlineToPath, strokeOutline } from '../../../design/draw/freehand.js';
import { PEN_SIZES } from '../../../design/shapes/shapes.js';
import { useEditor, useUi } from './hooks.js';

/**
 * The stroke being drawn right now, painted straight from the draw tool's
 * draft — no store, no React render per sample. The path's `d` is written in a
 * requestAnimationFrame, so a 240Hz pen costs one paint per frame.
 */
export function DraftStroke() {
  const editor = useEditor();
  const tool = useUi((s) => s.tool);
  const pathRef = useRef(null);
  const svgRef = useRef(null);

  useEffect(() => {
    const drawTool = editor.currentTool();
    if (!drawTool.subscribeDraft) return undefined;
    let frame = 0;
    const paint = () => {
      frame = 0;
      const draft = drawTool.draft;
      const path = pathRef.current;
      if (!path) return;
      if (!draft || !draft.points.length) {
        path.setAttribute('d', '');
        return;
      }
      const size = PEN_SIZES[draft.style.size] || 4;
      const highlighter = draft.kind === 'highlighter';
      const outline = strokeOutline(draft.points, {
        size: highlighter ? size * 3 : size,
        thinning: highlighter ? 0 : 0.55,
        simulatePressure: !draft.pressure,
        taperEnd: false,
      });
      path.setAttribute('d', outlineToPath(outline));
      svgRef.current?.setAttribute('data-hue', draft.style.color);
      path.setAttribute('class', `sd-ink ${highlighter ? 'highlighter' : ''}`);
    };
    const off = drawTool.subscribeDraft(() => {
      if (!frame) frame = requestAnimationFrame(paint);
    });
    return () => {
      off();
      cancelAnimationFrame(frame);
    };
  }, [editor, tool]);

  if (tool !== 'pen' && tool !== 'highlighter') return null;
  return (
    <svg ref={svgRef} className="sd-draft" width="1" height="1" overflow="visible" aria-hidden="true">
      <path ref={pathRef} className="sd-ink" />
    </svg>
  );
}
