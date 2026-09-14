import { quantize, simplifyPoints } from '../../core/simplify.js';
import { PEN_SIZES } from '../../shapes/shapes.js';

/**
 * Pen and highlighter.
 *
 * While drawing, the stroke lives outside the store as a mutable draft — a
 * store record per sample would copy an ever-growing array every event — and
 * is painted by `DraftStroke` straight from the draft. On release it is
 * simplified (at a tolerance of a fraction of a screen pixel, so it looks the
 * same) and committed as one element.
 *
 * Every sample the device produced is used (`getCoalescedEvents`), not one per
 * frame, which is the difference between a smooth curve and a polygon on a
 * 240Hz stylus.
 */

const MAX_POINTS = 2000;

export function createDrawTool(editor, kind) {
  const { ui } = editor;
  let draft = null;
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn(draft));

  function add(ctx) {
    if (!draft) return;
    const pressure = ctx.pointerType === 'pen' ? Math.max(0.1, ctx.pressure) : 0.5;
    const point = [ctx.wx, ctx.wy, pressure];
    if (ctx.shift && draft.points.length) {
      draft.points = [draft.points[0], point];
      return;
    }
    const last = draft.points.at(-1);
    if (last && Math.hypot(point[0] - last[0], point[1] - last[1]) < 0.5 / editor.camera.z) return;
    draft.points.push(point);
  }

  function commitDraft() {
    const current = draft;
    draft = null;
    emit();
    if (!current || !current.points.length) return;

    const tolerance = 0.35 / editor.camera.z;
    let points = simplifyPoints(current.points, tolerance);
    if (points.length === 1) points = [points[0], [points[0][0] + 0.01, points[0][1], points[0][2]]];
    const size = PEN_SIZES[current.style.size] || 4;
    const chunks = [];
    for (let i = 0; i < points.length; i += MAX_POINTS - 1) chunks.push(points.slice(i, i + MAX_POINTS));

    editor.commit(kind === 'highlighter' ? 'Highlight' : 'Draw', (tx) => {
      for (const chunk of chunks) {
        const xs = chunk.map((p) => p[0]);
        const ys = chunk.map((p) => p[1]);
        const pad = (kind === 'highlighter' ? size * 3 : size) / 2 + 1;
        const minX = Math.floor(Math.min(...xs) - pad);
        const minY = Math.floor(Math.min(...ys) - pad);
        const maxX = Math.ceil(Math.max(...xs) + pad);
        const maxY = Math.ceil(Math.max(...ys) + pad);
        const parent = current.parent;
        const origin = editor.worldOrigin(parent);
        const flat = [];
        for (const [x, y, p] of chunk) flat.push(quantize(x - minX, 0.01), quantize(y - minY, 0.01), quantize(p, 0.02));
        const record = editor.newRecord(
          'stroke',
          { kind, x: minX - origin.x, y: minY - origin.y, w: maxX - minX, h: maxY - minY, points: flat, simulate: !current.pressure, ...current.style },
          { parent, tx },
        );
        if (kind === 'highlighter') record.z = editor.zAtBottom(parent, tx);
        tx.create(record);
      }
    });
  }

  return {
    id: kind,
    cursor: 'crosshair',
    wantsCoalesced: true,

    get draft() {
      return draft;
    },
    subscribeDraft(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    onPointerDown(ctx) {
      const style = ui.get().toolStyle[kind] || {};
      draft = {
        kind,
        pressure: ctx.pointerType === 'pen',
        style: { color: style.color || (kind === 'highlighter' ? 'amber' : 'ink'), size: style.size || (kind === 'highlighter' ? 'l' : 'm') },
        points: [],
        parent: editor.frameAt(ctx.wx, ctx.wy),
      };
      add(ctx);
      emit();
    },

    onSamples(samples) {
      if (!draft) return;
      for (const sample of samples) add(sample);
      emit();
    },

    onPointerMove(ctx) {
      if (!draft) return;
      if (ctx.shift) add(ctx);
      emit();
    },

    onPointerUp(ctx) {
      if (!draft) return;
      add(ctx);
      commitDraft();
    },

    onCancel() {
      draft = null;
      emit();
    },

    onKeyDown(event) {
      if (event.key === 'Escape' && draft) {
        draft = null;
        emit();
        return true;
      }
      return false;
    },
  };
}
