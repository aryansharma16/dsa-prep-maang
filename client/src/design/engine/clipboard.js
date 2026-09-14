import { keyBetween } from '../core/fractional.js';
import { newId } from '../core/ids.js';
import { isKnownType } from '../shapes/registry.js';

/**
 * Copy and paste of board elements — within a board, across boards, across tabs.
 *
 * The payload travels through the system clipboard as JSON inside a `text/html`
 * marker (and plain text as a fallback), so a copy in one tab pastes in another
 * without any app state being shared. Pasting always mints fresh ids and
 * re-points every internal reference — parent frames, connector ends — at the
 * copies, so pasting twice gives two independent sets rather than two elements
 * fighting over one id.
 */

const MARKER = 'ember-design';
const VERSION = 1;

/**
 * The selection, with descendants and with coordinates made absolute for the
 * top level (so a child copied out of a frame pastes where it appeared).
 */
export function serializeSelection(editor, ids = editor.ui.get().selection) {
  const { store } = editor;
  const chosen = new Set(ids);
  // Drop anything whose ancestor is also selected — it comes along with the ancestor.
  const roots = ids.filter((id) => store.has(id) && !editor.ancestors(id).some((a) => chosen.has(a)));
  const records = [];
  const include = (id, top) => {
    const record = store.get(id);
    if (!record || !isKnownType(record.type)) return;
    if (top) {
      const origin = editor.worldOrigin(record.parent);
      const data = { ...record.data };
      if (record.type !== 'connector') {
        data.x = (data.x || 0) + origin.x;
        data.y = (data.y || 0) + origin.y;
      } else {
        for (const key of ['start', 'end']) {
          if (data[key]?.point) data[key] = { point: [data[key].point[0] + origin.x, data[key].point[1] + origin.y] };
        }
      }
      records.push({ id: record.id, type: record.type, parent: null, z: record.z, data });
    } else {
      records.push({ id: record.id, type: record.type, parent: record.parent, z: record.z, data: record.data });
    }
    for (const child of store.childIds(id)) include(child, false);
  };
  const order = new Map(editor.paintOrder().map((id, i) => [id, i]));
  roots.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  for (const id of roots) include(id, true);

  // A connector whose ends are both left behind still copies, with free ends where they were.
  for (const record of records) {
    if (record.type !== 'connector') continue;
    const inSet = (eid) => records.some((r) => r.id === eid);
    const original = store.get(record.id);
    const geo = editor.connectorGeo(original);
    // Top-level copies are in world space; a connector copied inside its frame stays relative to it.
    const origin = record.parent ? editor.worldOrigin(original.parent) : { x: 0, y: 0 };
    const data = { ...record.data };
    if (data.start?.eid && !inSet(data.start.eid)) data.start = { point: [geo.start.x - origin.x, geo.start.y - origin.y] };
    if (data.end?.eid && !inSet(data.end.eid)) data.end = { point: [geo.end.x - origin.x, geo.end.y - origin.y] };
    record.data = data;
  }
  return { [MARKER]: VERSION, records };
}

export function toClipboardData(payload) {
  const json = JSON.stringify(payload);
  const encoded = btoa(unescape(encodeURIComponent(json)));
  return {
    html: `<span data-${MARKER}="${encoded}"></span>`,
    text: json,
  };
}

export function fromClipboardData({ html, text }) {
  const match = html && html.match(new RegExp(`data-${MARKER}="([^"]+)"`));
  const candidates = [];
  if (match) {
    try {
      candidates.push(decodeURIComponent(escape(atob(match[1]))));
    } catch {
      /* not ours */
    }
  }
  if (text) candidates.push(text);
  for (const raw of candidates) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed[MARKER] === VERSION && Array.isArray(parsed.records)) return parsed;
    } catch {
      /* not JSON */
    }
  }
  return null;
}

/**
 * New records for a payload, placed with their bounding box's top-left at
 * (dx, dy) relative to where they were copied from. Returns the records in
 * creation order and the ids of the top-level ones.
 */
export function instantiate(payload, { offsetX = 0, offsetY = 0, parent = null, zAfter = null } = {}) {
  const idMap = new Map(payload.records.map((r) => [r.id, newId()]));
  const topLevel = payload.records.filter((r) => !r.parent || !idMap.has(r.parent));
  const zKeys = new Map();
  let lastZ = zAfter;
  for (const record of topLevel) {
    lastZ = keyBetween(lastZ, null);
    zKeys.set(record.id, lastZ);
  }

  const records = payload.records.map((record) => {
    const top = !record.parent || !idMap.has(record.parent);
    const data = { ...record.data };
    if (top && record.type !== 'connector') {
      data.x = (data.x || 0) + offsetX;
      data.y = (data.y || 0) + offsetY;
    }
    if (record.type === 'connector') {
      for (const endKey of ['start', 'end']) {
        const end = data[endKey];
        if (end?.eid) data[endKey] = idMap.has(end.eid) ? { ...end, eid: idMap.get(end.eid) } : { point: end.point || [0, 0] };
        else if (end?.point && top) data[endKey] = { point: [end.point[0] + offsetX, end.point[1] + offsetY] };
      }
      if (data.waypoints && top) data.waypoints = data.waypoints.map(([x, y]) => [x + offsetX, y + offsetY]);
    }
    return {
      id: idMap.get(record.id),
      type: record.type,
      parent: top ? parent : idMap.get(record.parent),
      z: top ? zKeys.get(record.id) : record.z,
      data,
    };
  });
  return { records, topIds: topLevel.map((r) => idMap.get(r.id)) };
}
