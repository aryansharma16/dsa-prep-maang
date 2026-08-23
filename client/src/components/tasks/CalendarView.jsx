import { useMemo, useState } from 'react';
import { IconChevronRight } from '../ui/Icons.jsx';
import { dateInputValue } from './time.js';

/**
 * Tasks on a month, by deadline.
 *
 * With an **Unscheduled** tray beside it, and that tray is not a nicety.
 * Deadlines default to unlimited on purpose — most tasks genuinely have none —
 * so a calendar that only drew the dated ones would show an almost empty month
 * and read as broken rather than as accurate. The tray is where the rest of the
 * board is, and dragging out of it is how a task gets a date.
 *
 * Weeks start on Monday. The two days you are least likely to plan work for
 * belong next to each other at the end, not split across the two ends of the
 * row.
 */

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

/** Monday of the week containing the 1st. */
function gridStart(month) {
  const first = startOfMonth(month);
  const weekday = (first.getDay() + 6) % 7; // Sunday is 0 natively; make Monday 0.
  const start = new Date(first);
  start.setDate(first.getDate() - weekday);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function CalendarView({ tasks, statuses, onOpen, onSchedule }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [dragging, setDragging] = useState(null);
  const [over, setOver] = useState(null);

  const hueOf = useMemo(() => {
    const index = new Map(statuses.map((status) => [String(status.id), status]));
    return (task) => index.get(String(task.status))?.hue;
  }, [statuses]);

  const { cells, unscheduled } = useMemo(() => {
    const byDay = new Map();
    const loose = [];

    for (const task of tasks) {
      if (!task.dueAt) {
        loose.push(task);
        continue;
      }
      const key = dateInputValue(task.dueAt);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(task);
    }

    const start = gridStart(month);
    const out = [];
    // Six rows always. A month that needs five and a month that needs six would
    // otherwise change the page height as you step through them.
    for (let i = 0; i < 42; i += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const key = dateInputValue(date);
      out.push({
        key,
        date,
        outside: date.getMonth() !== month.getMonth(),
        tasks: byDay.get(key) || [],
      });
    }

    return { cells: out, unscheduled: loose };
  }, [tasks, month]);

  const today = dateInputValue(new Date());

  const step = (delta) =>
    setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));

  const drop = (cell) => {
    if (dragging) onSchedule(dragging, cell ? cell.date : null);
    setDragging(null);
    setOver(null);
  };

  const chip = (task) => (
    <button
      key={task.id}
      type="button"
      className="tk-cal-chip"
      data-hue={hueOf(task)}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', task.id);
        setDragging(task);
      }}
      onDragEnd={() => {
        setDragging(null);
        setOver(null);
      }}
      onClick={() => onOpen(task)}
      title={task.title}
    >
      <i className="tk-dot" aria-hidden="true" />
      <span>{task.title}</span>
    </button>
  );

  return (
    <div className="tk-cal-wrap">
      <div className="tk-cal">
        <header className="tk-cal-head">
          <button type="button" className="icon-btn back" onClick={() => step(-1)} aria-label="Previous month">
            <IconChevronRight size={13} />
          </button>
          <h2>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
          <button type="button" className="icon-btn" onClick={() => step(1)} aria-label="Next month">
            <IconChevronRight size={13} />
          </button>
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={() => setMonth(startOfMonth(new Date()))}>
            Today
          </button>
        </header>

        <div className="tk-cal-days">
          {DAYS.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>

        <div className="tk-cal-grid">
          {cells.map((cell) => (
            <div
              key={cell.key}
              className={`tk-cal-cell ${cell.outside ? 'outside' : ''} ${
                cell.key === today ? 'today' : ''
              } ${over === cell.key ? 'over' : ''}`}
              onDragOver={(event) => {
                if (!dragging) return;
                event.preventDefault();
                setOver(cell.key);
              }}
              onDrop={(event) => {
                event.preventDefault();
                drop(cell);
              }}
            >
              <span className="tk-cal-num mono">{cell.date.getDate()}</span>
              {cell.tasks.map(chip)}
            </div>
          ))}
        </div>
      </div>

      <aside
        className={`tk-cal-tray ${over === 'none' ? 'over' : ''}`}
        onDragOver={(event) => {
          if (!dragging) return;
          event.preventDefault();
          setOver('none');
        }}
        onDrop={(event) => {
          event.preventDefault();
          drop(null);
        }}
      >
        <h3>
          Unscheduled
          <span className="tk-col-count mono">{unscheduled.length}</span>
        </h3>
        <p className="hint dim">Drag one onto a day to give it a deadline, or back here to clear it.</p>
        <div className="tk-cal-loose">
          {unscheduled.length === 0 ? (
            <p className="hint dim">Everything has a date.</p>
          ) : (
            unscheduled.map(chip)
          )}
        </div>
      </aside>
    </div>
  );
}
