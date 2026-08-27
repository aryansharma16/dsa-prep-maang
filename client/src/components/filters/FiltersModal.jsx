import { clearPatch, toggleValue } from '../../filters/spec.js';
import { Dropdown } from '../ui/Dropdown.jsx';
import { Modal } from '../ui/Modal.jsx';
import { FilterChips } from './FilterChips.jsx';

/**
 * A screen's filters, in a dialog, rendered from its spec.
 *
 * They moved off the bar because they were a row of selects wide and only ever
 * two of them were set — on a phone that was most of the screen spent on
 * controls nobody had touched. What stayed out there is what you reach for
 * mid-session: the two flags and the random pick.
 *
 * Applied live rather than behind a Save, unlike the columns dialog. A filter is
 * exploratory — you set one to find out what it leaves — and the count in the
 * footer answers that without closing anything. There is nothing to undo here
 * either: Clear all is one click, and the bar shows what is on.
 *
 * Nothing in this file knows what a roadmap is. It takes a spec (see
 * filters/spec.js) and renders a control per field, which is what lets the next
 * module have the same dialog by declaring its filters rather than by copying
 * this. The only screen-specific input is `options` — the lists that come from
 * loaded data rather than from the code.
 *
 * @param spec     from defineFilters
 * @param value    the current filter bag
 * @param options  {[fieldId]: string[] | {value,label,note}[]} for data-driven fields
 */

/* Up to four short options, so a segmented control beats a dropdown: every
   choice is visible, and picking one is a tap rather than a tap, a scroll and a
   tap. Declared per field with `control: 'segmented'`. */
function Segmented({ label, options, value, onChange }) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="size-group filter-seg">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? 'on' : ''}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * A numeric interval, as two bounded number inputs plus optional presets.
 *
 * Two inputs rather than a slider, deliberately. A rating range is a number
 * somebody knows — "1400 to 1600" is a thought they already had — and a slider
 * makes them approach it by dragging. It is also the only control here that has
 * to work on a phone, where a two-handled slider inside a scrolling dialog is a
 * fight between the two gestures.
 *
 * Either end may be left empty, meaning unbounded on that side; the field is
 * only "set" once at least one has a value.
 */
function Range({ field, value, onChange }) {
  const current = value || { min: null, max: null };
  const set = (part) => {
    const next = { ...current, ...part };
    onChange({ [field.id]: next.min == null && next.max == null ? null : next });
  };
  const parse = (raw) => (raw === '' ? null : Number(raw));

  return (
    <div className="field field-wide">
      <span>{field.label}</span>
      <div className="range-row">
        <input
          type="number"
          className="range-input mono"
          inputMode="numeric"
          placeholder={field.minPlaceholder ?? 'Min'}
          aria-label={`${field.label} minimum`}
          value={current.min ?? ''}
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          onChange={(e) => set({ min: parse(e.target.value) })}
        />
        <span className="range-dash">–</span>
        <input
          type="number"
          className="range-input mono"
          inputMode="numeric"
          placeholder={field.maxPlaceholder ?? 'Max'}
          aria-label={`${field.label} maximum`}
          value={current.max ?? ''}
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          onChange={(e) => set({ max: parse(e.target.value) })}
        />
        {(current.min != null || current.max != null) && (
          <button
            type="button"
            className="link-btn"
            onClick={() => onChange({ [field.id]: null })}
          >
            Clear
          </button>
        )}
      </div>

      {/* The bands somebody actually works in, so the common case is one tap
          rather than two numbers typed. */}
      {field.presets?.length > 0 && (
        <div className="range-presets">
          {field.presets.map((preset) => {
            const on = current.min === preset.min && current.max === preset.max;
            return (
              <button
                key={preset.label}
                type="button"
                className={`toggle-chip ${on ? 'on' : ''}`}
                onClick={() =>
                  onChange({ [field.id]: on ? null : { min: preset.min, max: preset.max } })
                }
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Callers pass plain strings for data-driven lists — a company is its own label. */
const asOptions = (list = []) =>
  list.map((item) => (typeof item === 'string' ? { value: item, label: item } : item));

function Field({ field, value, options, onChange }) {
  const set = (next) => onChange({ [field.id]: next });

  if (field.control === 'segmented') {
    return (
      <Segmented
        label={field.label}
        options={asOptions(options ?? field.options)}
        value={value}
        onChange={set}
      />
    );
  }

  if (field.kind === 'range') {
    return <Range field={field} value={value} onChange={onChange} />;
  }

  if (field.kind === 'many') {
    return (
      <div className="field">
        <span>{field.label}</span>
        <Dropdown
          multiple
          ariaLabel={field.label}
          value={value}
          options={asOptions(options ?? field.options)}
          placeholder={field.placeholder ?? `Any ${field.label.toLowerCase()}`}
          onChange={set}
        />
        <FilterChips
          values={value}
          noun={field.label.toLowerCase()}
          onRemove={(v) => set(toggleValue(value, v))}
          onClear={() => set([])}
        />
      </div>
    );
  }

  return (
    <div className="field">
      <span>{field.label}</span>
      <Dropdown
        ariaLabel={field.label}
        value={value}
        options={asOptions(options ?? field.options)}
        onChange={set}
      />
    </div>
  );
}

export function FiltersModal({
  spec,
  value,
  options = {},
  shown,
  total,
  onChange,
  onClose,
  title = 'Filters',
}) {
  const fields = spec.fields
    .filter((f) => (f.place ?? 'dialog') === 'dialog')
    /*
      A data-driven list with nothing in it is dropped rather than rendered
      empty. Those fields take their options from the loaded rows — companies,
      topics, contests — and on a curriculum that carries none of one of them
      (Codeforces publishes nothing about who asks what) the control is a
      dropdown that can only ever return nothing, sitting there implying the
      data exists.

      Only when the value is *also* empty. A field still holding a selection has
      to stay visible, or a saved filter from another curriculum would narrow the
      list with no control able to clear it.
    */
    .filter((f) => {
      if (f.options || !['one', 'many'].includes(f.kind)) return true;
      const list = options[f.id];
      if (list?.length) return true;
      return f.kind === 'many' ? value[f.id]?.length > 0 : Boolean(value[f.id]);
    });

  return (
    /*
      Wider than the app's other dialogs, and laid out in columns — see
      `.modal.filters` in app.css for why a filter panel is the one dialog that
      must not need scrolling to see what is already on.
    */
    <Modal title={title} onClose={onClose} size="filters">
      <div className="modal-body filters-body">
        {fields.map((field) => (
          <Field
            key={field.id}
            field={field}
            value={value[field.id]}
            options={options[field.id]}
            onChange={onChange}
          />
        ))}
      </div>

      <div className="modal-foot">
        {/* The whole reason this can apply live and still be closed-loop. */}
        <span className="hint mono" style={{ marginRight: 'auto' }}>
          {shown} of {total}
        </span>
        {/* Clears what this dialog holds and leaves the bar's toggles alone —
            they have their own clear, two clicks away, and a button that reached
            outside the thing it is inside would be a surprise. */}
        <button type="button" className="btn" onClick={() => onChange(clearPatch(spec, 'dialog'))}>
          Clear all
        </button>
        <button type="button" className="btn primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
