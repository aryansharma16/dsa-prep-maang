/**
 * Camera math for the infinite canvas.
 *
 * A camera is `{ x, y, z }`: world point `p` is drawn at `p * z + (x, y)` on
 * screen. That is exactly the CSS transform on the world layer —
 * `translate(x px, y px) scale(z)` with a top-left origin — so the math here and
 * what the browser paints can never disagree.
 *
 * Pure. The part that writes the transform to the DOM once per frame lives in
 * the editor; this file only answers questions.
 */

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 8;
export const ZOOM_STEPS = [0.05, 0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8];

export const clampZoom = (z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export const screenToWorld = (cam, sx, sy) => ({ x: (sx - cam.x) / cam.z, y: (sy - cam.y) / cam.z });

export const worldToScreen = (cam, wx, wy) => ({ x: wx * cam.z + cam.x, y: wy * cam.z + cam.y });

/** Zoom to `nextZ` keeping the world point under screen point (sx, sy) fixed. */
export function zoomAt(cam, sx, sy, nextZ) {
  const z = clampZoom(nextZ);
  const k = z / cam.z;
  return { x: sx - (sx - cam.x) * k, y: sy - (sy - cam.y) * k, z };
}

/** The next preset zoom level up (dir 1) or down (dir -1) from `z`. */
export function stepZoom(z, dir) {
  if (dir > 0) return ZOOM_STEPS.find((step) => step > z + 1e-6) ?? MAX_ZOOM;
  return [...ZOOM_STEPS].reverse().find((step) => step < z - 1e-6) ?? MIN_ZOOM;
}

/** The world-space rectangle currently on screen. */
export function viewportBounds(cam, width, height) {
  const a = screenToWorld(cam, 0, 0);
  const b = screenToWorld(cam, width, height);
  return { minX: a.x, minY: a.y, maxX: b.x, maxY: b.y };
}

/**
 * A camera that fits `bounds` inside a `width`×`height` viewport.
 * `maxZoom` stops a single small shape being blown up to fill the screen.
 */
export function fitBounds(bounds, width, height, { padding = 64, maxZoom = 1 } = {}) {
  const bw = Math.max(1, bounds.maxX - bounds.minX);
  const bh = Math.max(1, bounds.maxY - bounds.minY);
  const availableW = Math.max(1, width - padding * 2);
  const availableH = Math.max(1, height - padding * 2);
  const z = clampZoom(Math.min(availableW / bw, availableH / bh, maxZoom));
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  return { x: width / 2 - cx * z, y: height / 2 - cy * z, z };
}

/** A camera centred on a world point at the current zoom. */
export const centerOn = (cam, wx, wy, width, height) => ({ x: width / 2 - wx * cam.z, y: height / 2 - wy * cam.z, z: cam.z });

/**
 * Coarse zoom bands for level-of-detail rendering. React only re-renders on a
 * band change, never on every zoom tick.
 */
export const zoomBucket = (z) => (z < 0.25 ? 'far' : z < 0.6 ? 'mid' : 'near');

/**
 * Wheel delta in pixels, whatever unit the device reported. Firefox on some
 * mice sends lines; a few devices send pages.
 */
export function wheelPixels(event, viewportHeight = 800) {
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewportHeight : 1;
  return { dx: event.deltaX * unit, dy: event.deltaY * unit };
}

/** Zoom factor for a pinch or ctrl-wheel delta. Smooth, and symmetric in and out. */
export const wheelZoomFactor = (dy) => Math.exp(-Math.max(-60, Math.min(60, dy)) * 0.0105);

/** Snap a translation to device pixels so text and 1px lines stay sharp at rest. */
export const snapToDevicePixels = (value, dpr = 1) => Math.round(value * dpr) / dpr;
