/**
 * The filter engine, one level up from any particular screen.
 *
 * A screen declares *what* its filters are — a name, a shape, and what it means
 * for a row to match one — and everything else falls out of that declaration:
 * the dialog that renders them, the count on the Filters chip, what Clear all
 * clears, what gets saved to the account, and what a saved set has to be
 * reconciled against when it comes back from a deploy ago.
 *
 * The alternative, and what the roadmap was before this, is a `useState` per
 * filter plus the same seven places to remember to add a line to. Adding a topic
 * filter that way touched eight of them; adding one here is one entry in one
 * array.
 *
 * A field:
 *
 *   {
 *     id:      'topics',              // the key in the filter bag, and in the DB
 *     kind:    'many',                // 'one' | 'many' | 'flag'
 *     label:   'Topics',
 *     place:   'dialog',              // 'dialog' (behind the button) | 'bar'
 *     options: [{ value, label, note }],   // 'one'/'many'; omit when data-driven
 *     placeholder: 'All topics',
 *     match:   (item, value) => boolean,
 *   }
 *
 * `match` is only ever called with a value that is actually set, so it never has
 * to open with an "if nothing is selected" guard — that check is here, once,
 * rather than once per field.
 *
 * The four kinds are the four shapes a control can produce, not four ideas
 * about data: a flag is a toggle, `one` is a choice, `many` is a set, `range` is
 * an interval. `many` is OR within the field and AND across fields — "Google or
 * Amazon, and Hard" is what someone means by ticking two companies and picking a
 * difficulty. An AND within a field ("problems tagged both graph and DP") is a
 * different question and not one anybody asks of a prep list.
 *
 * `range` exists because a numeric axis is not a set of choices. The CP ladder
 * is organised by Codeforces rating, which runs 800 to 3500 in 28 steps — as a
 * multi-select that is a scrolling list nobody wants, and as a single choice it
 * cannot express "everything I should be attempting right now", which is the
 * only question anyone actually asks of it. Its value is `{ min, max }` with
 * either side allowed to be null, meaning unbounded on that side.
 */

/** The value a field holds when nothing is chosen. */
const EMPTY = { one: '', many: [], flag: false, range: null };

const isEmptyValue = (kind, value) => {
  if (kind === 'many') return !value?.length;
  if (kind === 'flag') return !value;
  /*
    A range with both ends null is not a filter — it is the whole axis. Treating
    it as set would leave the Filters badge counting a field that hides nothing,
    and Clear would have something to clear that was never chosen.
  */
  if (kind === 'range') {
    return !value || (value.min == null && value.max == null);
  }
  return !value;
};

export function defineFilters(fields) {
  const byId = Object.fromEntries(fields.map((f) => [f.id, f]));
  return { fields, byId };
}

export const emptyFilters = (spec) =>
  Object.fromEntries(spec.fields.map((f) => [f.id, EMPTY[f.kind]]));

/**
 * Coerces a stored bag into the shape the current code expects.
 *
 * This is the same job `useTableLayout`'s reconcile does for columns, and it
 * exists for the same reason: a saved value outlives the code that produced it.
 * It arrives from localStorage written by a build from three deploys ago, or
 * from an account last used on another machine, and a filter that has since
 * changed kind — or been deleted outright — must not be able to put the page
 * into a state with no control able to clear it.
 *
 * Values are *not* checked against the current option list. A saved company that
 * no longer appears in the roadmap stays selected and shows as a chip matching
 * nothing, which is visible and removable; dropping it silently would be neither.
 * It also could not be done safely here — the options come from data that has not
 * loaded on the render this first runs.
 */
export function normalizeFilters(spec, raw) {
  const source = raw && typeof raw === 'object' ? raw : {};

  return Object.fromEntries(
    spec.fields.map((field) => {
      const value = source[field.id];

      if (field.kind === 'flag') return [field.id, Boolean(value)];
      if (field.kind === 'one') return [field.id, typeof value === 'string' ? value : ''];

      if (field.kind === 'range') {
        if (!value || typeof value !== 'object') return [field.id, null];
        const num = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : null);
        const min = num(value.min);
        const max = num(value.max);
        if (min == null && max == null) return [field.id, null];
        // A stored range from a build where the bounds were the other way round
        // matches nothing and offers no control that would fix it.
        return [field.id, min != null && max != null && min > max ? { min: max, max: min } : { min, max }];
      }

      // A bare string is a field that used to be `one` and is now `many` (the
      // roadmap's Sheet did this) — keep the old choice as a one-item set.
      const raw = typeof value === 'string' && value ? [value] : value;
      const list = Array.isArray(raw) ? raw.filter((v) => typeof v === 'string' && v) : [];
      // A duplicate would render two identical chips, and removing one would
      // look like it did nothing.
      return [field.id, [...new Set(list)]];
    }),
  );
}

/** `place` narrows to one group — the dialog's badge counts only its own. */
const fieldsIn = (spec, place) =>
  place ? spec.fields.filter((f) => (f.place ?? 'dialog') === place) : spec.fields;

/**
 * How many filters are on, counting a multi-select as one however many values it
 * holds. The badge answers "how much is being hidden from me", and three
 * companies is one reason the list is short, not three.
 */
export const activeCount = (spec, filters, place) =>
  fieldsIn(spec, place).filter((f) => !isEmptyValue(f.kind, filters[f.id])).length;

export const isFiltering = (spec, filters) => activeCount(spec, filters) > 0;

/**
 * A patch that empties one group and says nothing about the rest — Clear all in
 * the dialog is not Clear all in the bar, and the two buttons are two clicks
 * apart. Omitting `place` clears everything.
 *
 * A patch rather than a whole bag on purpose: it is applied against whatever the
 * filters are when the click lands, so a control that changed since this render
 * is not quietly reverted along with it.
 */
export const clearPatch = (spec, place) =>
  Object.fromEntries(fieldsIn(spec, place).map((f) => [f.id, EMPTY[f.kind]]));

/** Does this row survive every filter that is on? AND across fields. */
export function matchesFilters(spec, filters, item) {
  for (const field of spec.fields) {
    const value = filters[field.id];
    if (isEmptyValue(field.kind, value)) continue;
    if (!field.match(item, value)) return false;
  }
  return true;
}

/**
 * The bag as it goes to the account: only what is actually set.
 *
 * Empty values are dropped rather than sent as `''` and `[]`, which is what lets
 * "no filters" arrive at the server as `{}` and delete the row instead of
 * storing a document that says nothing. It also keeps a saved view from pinning
 * the defaults of filters that did not exist when it was written.
 */
export const toPayload = (spec, filters) =>
  Object.fromEntries(
    spec.fields
      .filter((f) => !isEmptyValue(f.kind, filters[f.id]))
      .map((f) => [f.id, filters[f.id]]),
  );

/**
 * A stable string for "is this the same filter set". Used to decide whether a
 * save is worth a request; arrays are sorted so reordering a multi-select — which
 * the user cannot even see — does not read as a change.
 */
export const filterKey = (spec, filters) =>
  spec.fields
    .map((f) => {
      const value = filters[f.id];
      if (Array.isArray(value)) return `${f.id}=${[...value].sort().join(',')}`;
      // An object stringifies to [object Object], so every range would compare
      // equal to every other and a changed bound would never be saved.
      if (f.kind === 'range') return `${f.id}=${value ? `${value.min ?? ''}-${value.max ?? ''}` : ''}`;
      return `${f.id}=${value}`;
    })
    .join('|');

/** Add or remove one value from a `many` field. */
export const toggleValue = (list, value) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
