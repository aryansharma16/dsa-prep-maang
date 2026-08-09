import { Dropdown } from '../ui/Dropdown.jsx';
import { Modal } from '../ui/Modal.jsx';

/**
 * The four narrowing filters, in a dialog.
 *
 * They moved off the bar because they were four selects wide and only ever two
 * of them were set — on a phone that was most of the screen spent on controls
 * nobody had touched. What stayed out there is what you reach for mid-session:
 * the two flags and the random pick.
 *
 * Applied live rather than behind a Save, unlike the columns dialog. A filter
 * is exploratory — you set one to find out what it leaves — and the count in
 * the footer answers that without closing anything. There is nothing to undo
 * here either: Clear all is one click, and the bar shows what is on.
 */

const DIFFICULTIES = [
  ['', 'All'],
  ['Easy', 'Easy'],
  ['Medium', 'Medium'],
  ['Hard', 'Hard'],
];

const STATUSES = [
  ['', 'Any'],
  ['todo', 'Not started'],
  ['attempted', 'Attempted'],
  ['solved', 'Solved'],
];

const SHEET_OPTIONS = [
  { value: '', label: 'All sheets' },
  { value: 'striver-sde', label: "Striver's SDE Sheet", note: '191 problems, day by day' },
  { value: 'neetcode-150', label: 'NeetCode 150', note: 'The pattern-first 150' },
  { value: 'blind-75', label: 'Blind 75', note: 'The original short list' },
];

/* Four short options each, so a segmented control beats a select: every choice
   is visible, and picking one is a tap rather than a tap, a scroll and a tap. */
function Segmented({ label, options, value, onChange }) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="size-group filter-seg">
        {options.map(([id, text]) => (
          <button
            key={id}
            type="button"
            className={value === id ? 'on' : ''}
            aria-pressed={value === id}
            onClick={() => onChange(id)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FiltersModal({ value, companies, shown, total, onChange, onClear, onClose }) {
  const { difficulty, company, sheet, status } = value;

  // Rebuilt per open rather than memoised: the dialog only exists while it is
  // on screen, and the roadmap's company list does not change under it.
  const companyOptions = [
    { value: '', label: 'All companies' },
    ...companies.map((c) => ({ value: c, label: c })),
  ];

  return (
    <Modal title="Filters" onClose={onClose}>
      <div className="modal-body">
        <Segmented
          label="Difficulty"
          options={DIFFICULTIES}
          value={difficulty}
          onChange={(v) => onChange({ difficulty: v })}
        />

        <Segmented
          label="Status"
          options={STATUSES}
          value={status}
          onChange={(v) => onChange({ status: v })}
        />

        {/* Dropdowns, not segments: one of these is three long names and the
            other is every company in the roadmap, which is a list you filter
            rather than a row you scan. */}
        <div className="field">
          <span>Sheet</span>
          <Dropdown
            ariaLabel="Sheet"
            value={sheet}
            options={SHEET_OPTIONS}
            onChange={(v) => onChange({ sheet: v })}
          />
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <span>Company</span>
          <Dropdown
            ariaLabel="Company"
            value={company}
            options={companyOptions}
            onChange={(v) => onChange({ company: v })}
          />
        </div>
      </div>

      <div className="modal-foot">
        {/* The whole reason this can apply live and still be closed-loop. */}
        <span className="hint mono" style={{ marginRight: 'auto' }}>
          {shown} of {total}
        </span>
        <button type="button" className="btn" onClick={onClear}>
          Clear all
        </button>
        <button type="button" className="btn primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
