import { useState } from 'react';
import { useAttemptTimer } from '../../store/AttemptTimerContext.jsx';
import { clock } from '../tasks/time.js';
import { IconPause, IconPlay, IconStop } from '../ui/Icons.jsx';
import { AttemptModal } from './AttemptModal.jsx';

/**
 * The problem stopwatch, in the top bar, on every page.
 *
 * Same argument as the task pill beside it: a timer you cannot see is a timer
 * you forget to stop, and a forgotten one turns every minute this feature
 * records into a lie. It is also the point of the whole thing — you start the
 * clock, leave for LeetCode, and come back with the number already counted.
 *
 * The clock face is the button that ends the sitting, because "stop" and "log"
 * are the same intention and asking someone to find the row again to say it
 * twice is how the number gets abandoned.
 *
 * The pill itself is drawn only while there is a clock, which most of the time
 * there is not. The dialog it opens is not conditional on that — see below.
 */
export function AttemptTimerPill() {
  const { timer, running, elapsed, pause, resume, reset } = useAttemptTimer();
  /*
    The problem being logged, not a boolean. Logging clears the clock, and the
    clock is what draws this component — so a `logging` flag would take the
    dialog down with the pill halfway through submitting it. Holding the id and
    title here means the dialog outlives the thing that opened it.
  */
  const [logging, setLogging] = useState(null);

  return (
    <>
      {timer && (
        <div className={`tk-pill att-pill ${running ? '' : 'held'}`} title={timer.title}>
          <button
            type="button"
            className="tk-pill-open"
            onClick={() => setLogging({ _id: timer.problemId, title: timer.title })}
            aria-label={`Log an attempt on ${timer.title}`}
          >
            <span className="tk-pill-dot" aria-hidden="true" />
            <span className="mono">{clock(elapsed())}</span>
            <span className="tk-pill-title">{timer.title}</span>
          </button>

          <button
            type="button"
            className="icon-btn"
            onClick={() => (running ? pause() : resume())}
            aria-label={running ? 'Pause the problem timer' : 'Resume the problem timer'}
            title={running ? 'Pause' : 'Resume'}
          >
            {running ? <IconPause size={10} /> : <IconPlay size={10} />}
          </button>

          <button
            type="button"
            className="icon-btn"
            onClick={reset}
            aria-label="Discard the problem timer"
            title="Discard"
          >
            <IconStop size={10} />
          </button>
        </div>
      )}

      {/* The id and the title are all the dialog needs to exist away from the
          table row that started it. */}
      {logging && <AttemptModal problem={logging} onClose={() => setLogging(null)} />}
    </>
  );
}
