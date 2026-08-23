import { IconClock, IconPlay, IconStop } from '../ui/Icons.jsx';
import { useTasks } from '../../store/TasksContext.jsx';
import { clock, duration } from './time.js';

/**
 * Start or stop the clock on one task, and show what it has cost so far.
 *
 * Three states, and the middle one is the reason this is a component rather
 * than a button: a task that is *not* running but has time on it still has
 * something to say, and saying it in the same slot means the number does not
 * jump around the card when the clock stops.
 *
 * Elapsed time comes from the context so that every instance of this — the
 * card, the drawer, the top bar — counts off one interval against one clock,
 * rather than each starting its own and drifting apart by a frame.
 */
export function TimerButton({ task, size = 'sm', onChange }) {
  const { running, elapsed, start, stop } = useTasks();

  const isRunning = Boolean(running && String(running.id) === String(task.id));
  // The context's copy is the fresher one while it runs — the page's may predate
  // the last tick.
  const live = isRunning ? elapsed(running) : 0;
  const total = task.trackedSeconds || 0;

  const toggle = async (event) => {
    // On a card, the whole surface opens the drawer.
    event.stopPropagation();
    try {
      const next = isRunning ? await stop(task.id) : await start(task.id);
      onChange?.(next);
    } catch {
      // The context is unchanged, so the button springs back to what is true.
      // A toast here would fire on every flaky tap of a button whose state is
      // already self-correcting.
    }
  };

  return (
    <span className={`tk-timer ${size} ${isRunning ? 'on' : ''}`}>
      <button
        type="button"
        className="tk-timer-btn"
        onClick={toggle}
        aria-label={isRunning ? `Stop the timer on ${task.title}` : `Start a timer on ${task.title}`}
        title={isRunning ? 'Stop' : 'Start a timer'}
      >
        {isRunning ? <IconStop size={9} /> : <IconPlay size={9} />}
      </button>

      {isRunning ? (
        <span className="mono tk-timer-live">{clock(live)}</span>
      ) : (
        total > 0 && (
          <span className="mono tk-timer-total" title={`${duration(total)} logged`}>
            <IconClock size={10} />
            {duration(total)}
          </span>
        )
      )}
    </span>
  );
}
