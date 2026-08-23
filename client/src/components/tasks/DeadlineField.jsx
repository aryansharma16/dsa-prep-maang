import { dateFromInput, dateInputValue, deadlineLabel, isOverdue } from './time.js';

/**
 * The deadline, which is allowed to be nothing.
 *
 * The app has no date library and no date input anywhere else — this is the
 * first. It is a native `<input type="date">` rather than a hand-built calendar
 * for the reason the codebase keeps its dependency list at four packages: the
 * native control is keyboard-accessible, localised, and understands the phone
 * it is on, and a bespoke one would be a month of work to draw level with.
 *
 * The shortcuts above it are what actually get used. "Today" and "This weekend"
 * are how people think about their own week, and picking either out of a
 * calendar grid means counting squares.
 */

const shortcuts = [
  ['Today', 0],
  ['Tomorrow', 1],
  ['In 3 days', 3],
  ['Next week', 7],
];

const inDays = (days) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
};

export function DeadlineField({ value, onChange }) {
  const overdue = value && isOverdue({ dueAt: value, completedAt: null });

  return (
    <div className="tk-deadline">
      <div className="tk-deadline-row">
        <input
          type="date"
          className="tk-date"
          value={dateInputValue(value)}
          aria-label="Deadline"
          onChange={(event) => onChange(dateFromInput(event.target.value))}
        />
        {value ? (
          <button type="button" className="link-btn" onClick={() => onChange(null)}>
            Clear
          </button>
        ) : (
          <span className="hint dim">No deadline</span>
        )}
      </div>

      <div className="tk-deadline-quick">
        {shortcuts.map(([label, days]) => (
          <button
            key={label}
            type="button"
            className="toggle-chip"
            onClick={() => onChange(inDays(days))}
          >
            {label}
          </button>
        ))}
      </div>

      {value && (
        <p className={`hint ${overdue ? 'danger' : ''}`}>{deadlineLabel(value)}</p>
      )}
    </div>
  );
}
