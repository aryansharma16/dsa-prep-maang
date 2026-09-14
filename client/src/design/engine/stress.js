import { layoutStructure } from '../library/structures.js';
import { TECH } from '../library/tech.js';

/**
 * Performance tooling, reachable only with `?sdperf` in the URL (see BoardEditor):
 *
 *   __sd.stress(2000)        fill the board with a realistic mix of elements
 *   await __sd.measurePan()  pan across it for 3s and report frame times
 *
 * The mix matters more than the count: connectors re-route when things move,
 * text measures, logos load, structure blocks lay out — a board of 2,000 plain
 * rectangles would flatter the engine.
 */

const KINDS = ['rect', 'rect', 'ellipse', 'diamond', 'cylinder', 'sticky', 'text', 'tech', 'tech', 'structure'];

export function stressBoard(editor, count = 2000, { seed = 7 } = {}) {
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const cols = Math.ceil(Math.sqrt(count));
  const step = 220;
  const ids = [];
  const chunk = 400; // stays well under the server's 1,000 ops per batch
  let made = 0;
  while (made < count) {
    const n = Math.min(chunk, count - made);
    editor.commit('Stress test', (tx) => {
      for (let i = 0; i < n; i += 1) {
        const index = made + i;
        const type = KINDS[Math.floor(rand() * KINDS.length)];
        const x = (index % cols) * step + rand() * 40;
        const y = Math.floor(index / cols) * step + rand() * 40;
        let data = { x: Math.round(x), y: Math.round(y) };
        if (type === 'text') data = { ...data, text: `Service ${index}`, autoWidth: false, w: 140, h: 24 };
        else if (type === 'sticky') data = { ...data, text: `Idea ${index}` };
        else if (type === 'tech') data = { ...data, tech: TECH[Math.floor(rand() * TECH.length)].id };
        else if (type === 'structure') {
          const d = { kind: ['array', 'stack', 'queue', 'linkedlist'][index % 4], text: '1\n2\n3\n4', size: 's' };
          const size = layoutStructure(d);
          data = { ...data, ...d, w: size.w, h: size.h };
        } else data = { ...data, w: 120 + Math.round(rand() * 60), h: 70 + Math.round(rand() * 40), label: index % 3 ? `Node ${index}` : '' };
        const record = editor.newRecord(type, data, { parent: null, tx });
        tx.create(record);
        ids.push(record.id);
      }
      // About one connector for every five elements, joining neighbours.
      for (let i = made; i < made + n; i += 5) {
        const a = ids[i];
        const b = ids[i + 1] || ids[i - cols];
        if (!a || !b) continue;
        const record = editor.newRecord('connector', { start: { eid: a }, end: { eid: b }, route: 'elbow' }, { parent: null, tx });
        tx.create(record);
      }
    });
    made += n;
  }
  editor.zoomToFit?.();
  return ids.length;
}

/** Pans the camera for `ms` and reports frame-time statistics. */
export function measurePan(editor, { ms = 3000, speed = 900 } = {}) {
  return new Promise((resolve) => {
    const times = [];
    const start = performance.now();
    let last = start;
    const from = { ...editor.camera };
    const tick = (now) => {
      times.push(now - last);
      last = now;
      const t = (now - start) / 1000;
      editor.setCamera({ x: from.x - Math.sin(t * 1.3) * speed, y: from.y - Math.cos(t * 0.9) * speed * 0.6, z: from.z });
      if (now - start < ms) requestAnimationFrame(tick);
      else {
        times.shift();
        const sorted = [...times].sort((a, b) => a - b);
        const avg = times.reduce((sum, v) => sum + v, 0) / times.length;
        editor.setCamera(from);
        resolve({
          frames: times.length,
          fps: Math.round(1000 / avg),
          avgMs: Math.round(avg * 10) / 10,
          p95Ms: Math.round(sorted[Math.floor(sorted.length * 0.95)] * 10) / 10,
          worstMs: Math.round(sorted.at(-1) * 10) / 10,
          mounted: document.querySelectorAll('.sd-el').length,
          elements: editor.store.size,
        });
      }
    };
    requestAnimationFrame(tick);
  });
}
