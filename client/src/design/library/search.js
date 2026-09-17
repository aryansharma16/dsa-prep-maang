import { SQL_TABLE_TEMPLATES } from './sqlTable.js';
import { STRUCTURE_KINDS } from './structures.js';
import { rankMatches, TECH } from './tech.js';

/**
 * One search over the whole component library — technologies, data-structure
 * blocks and SQL tables — for the panel's search box, which looks in every tab
 * at once: typing "stack" with the Tech tab open should still find the block.
 *
 * Returns only the sections with matches, `{ id, label, items }` with `id` the
 * tab it comes from and `items` the catalogue entries themselves, best first.
 * Sections are ordered by their best match; a tie puts the open tab's section
 * first, then keeps the tabs' own order. Pure; ranking is `matchScore`'s.
 */

const SOURCES = [
  { id: 'tech', label: 'Tech', entries: TECH, fields: (entry) => entry },
  {
    id: 'structures',
    label: 'Data structures',
    entries: STRUCTURE_KINDS,
    fields: (kind) => ({ id: kind.id, name: kind.label, keywords: kind.keywords, about: kind.about }),
  },
  {
    id: 'database',
    label: 'SQL tables',
    entries: SQL_TABLE_TEMPLATES,
    // The DBML text stands in for a description, so "status" or "jsonb" find the tables that have them.
    fields: (template) => ({ id: template.id, name: template.label, keywords: template.keywords, about: template.text }),
  },
];

export function searchLibrary(query, openTab = 'tech') {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return [];
  return SOURCES.map((source) => ({ source, ranked: rankMatches(q, source.entries, source.fields) }))
    .filter(({ ranked }) => ranked.length)
    .sort((a, b) => b.ranked[0][0] - a.ranked[0][0] || (b.source.id === openTab) - (a.source.id === openTab))
    .map(({ source, ranked }) => ({ id: source.id, label: source.label, items: ranked.map(([, entry]) => entry) }));
}
