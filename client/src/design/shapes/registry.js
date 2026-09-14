import { inDiamond, inEllipse, inRect } from '../core/geometry.js';

/**
 * Element types: what each one is, as data — its defaults, what can be done to
 * it, how its outline is hit, what the inspector offers.
 *
 * The engine never switches on a type name. It asks the definition: can this be
 * rotated, does it take a label, is its interior clickable, what shape does an
 * arrow meet. Adding a type is a definition here plus a view in
 * components/design/shapes — nothing in the engine changes.
 *
 * Types the client does not know (a newer client wrote them) get `UNKNOWN`:
 * drawn as a placeholder, selectable, never modified and never re-sent.
 */

export const DEFAULT_CAPS = Object.freeze({
  resize: 'free', // free | aspect | width | none
  rotate: true,
  bindable: true, // connectors may attach
  container: false, // may hold children
  text: null, // label | text | null — what double-click edits
  hitInterior: true,
  erasable: true,
  snaps: true,
});

const registry = new Map();

export function defineShape(def) {
  const full = Object.freeze({
    kind: 'box',
    outline: 'rect',
    minW: 8,
    minH: 8,
    inspector: [],
    ...def,
    caps: Object.freeze({ ...DEFAULT_CAPS, ...(def.caps || {}) }),
  });
  registry.set(full.type, full);
  return full;
}

export const UNKNOWN = Object.freeze({
  type: 'unknown',
  label: 'Unsupported element',
  kind: 'box',
  outline: 'rect',
  minW: 8,
  minH: 8,
  inspector: [],
  defaults: () => ({}),
  caps: Object.freeze({ ...DEFAULT_CAPS, resize: 'none', rotate: false, bindable: false, erasable: false, snaps: false }),
});

export const shapeFor = (type) => registry.get(type) || UNKNOWN;
export const isKnownType = (type) => registry.has(type);
export const allShapes = () => [...registry.values()];

/** Point-in-shape for a box-like element, in its local (unrotated) frame. */
export function hitOutline(outline, lx, ly, w, h, tol) {
  if (outline === 'ellipse') return inEllipse(lx, ly, w, h, tol);
  if (outline === 'diamond') return inDiamond(lx, ly, w, h, tol);
  return inRect(lx, ly, w, h, tol);
}

/** Near the outline itself (not the interior) — how an empty frame or an unfilled box is clicked. */
export function hitOutlineEdge(outline, lx, ly, w, h, tol) {
  return hitOutline(outline, lx, ly, w, h, tol) && !hitOutline(outline, lx, ly, w, h, -tol);
}
