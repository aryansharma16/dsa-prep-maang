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
  const fields = spec.fields.filter((f) => (f.place ?? 'dialog') === 'dialog');

  return (
    <Modal title={title} onClose={onClose}>
      <div className="modal-body">
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
