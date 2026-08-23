import { useNavigate } from 'react-router-dom';
import { useTasks } from '../../store/TasksContext.jsx';
import { IconStop } from '../ui/Icons.jsx';
import { clock } from './time.js';

/**
 * The running clock, in the top bar, on every page.
 *
 * This is the whole reason the timer's state is a context rather than page
 * state. A timer you cannot see is a timer you forget to stop, and one
 * forgotten overnight makes every number the feature produces a lie — the
 * twelve-hour cap bounds the damage, it does not prevent it. Being visible
 * everywhere is the actual fix.
 *
 * Renders nothing when nothing is running, which is most of the time.
 */
export function TimerPill() {
  const { running, elapsed, stop } = useTasks();
  const navigate = useNavigate();

  if (!running) return null;

  return (
    <div className="tk-pill" title={running.title}>
      <button
        type="button"
        className="tk-pill-open"
        onClick={() => navigate('/tasks')}
        aria-label={`Open ${running.title} — timer running`}
      >
        <span className="tk-pill-dot" aria-hidden="true" />
        <span className="mono">{clock(elapsed(running))}</span>
        <span className="tk-pill-title">{running.title}</span>
      </button>

      <button
        type="button"
        className="icon-btn"
        onClick={() => stop(running.id).catch(() => {})}
        aria-label="Stop the timer"
        title="Stop"
      >
        <IconStop size={10} />
      </button>
    </div>
  );
}
