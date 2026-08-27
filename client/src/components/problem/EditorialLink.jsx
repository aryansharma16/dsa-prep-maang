import { useAttemptTimer } from '../../store/AttemptTimerContext.jsx';
import { IconLock } from '../ui/Icons.jsx';
import { EDITORIAL_GATE_MINUTES } from './attempts.js';
import { notePeek } from './peeks.js';

/**
 * A link to somebody else's answer, behind twenty-five minutes.
 *
 * The editorial, the video walkthrough and the CP solution links all go through
 * this. It is the one deliberate piece of friction in the app, and it is a hard
 * block rather than a warning because minute four is exactly when a warning gets
 * clicked through — and minute four is where the learning would have been.
 *
 * ---------------------------------------------------------------------------
 * What counts as time spent, and why it is two numbers.
 *
 * `progress.attemptMinutes` is the sum of every sitting already logged against
 * this problem. It is computed server-side and already rides along on every row
 * (see the aggregation in server/src/controllers/problem.controller.js), so it
 * is durable: it survives a closed browser, a different machine, and a cleared
 * cache.
 *
 * The running clock is added on top, because the twenty-five minutes you are in
 * the middle of should count while you are in the middle of them — otherwise the
 * gate opens only after you stop and log, which is the wrong moment.
 *
 * The durable half is what makes a hard block survivable at all. Gating on the
 * live timer alone — which is `localStorage` and single-problem — would mean
 * closing a tab locks an editorial you had genuinely earned, with no way back
 * except waiting another twenty-five minutes.
 * ---------------------------------------------------------------------------
 *
 * A solved problem is never gated. You have earned the answer, and comparing
 * your solution against a better one is the most useful thing you can do next.
 */
export function EditorialLink({ problem, progress = {}, href, title, className = '', children }) {
  const timer = useAttemptTimer();

  const logged = progress.attemptMinutes || 0;
  const live = timer.isOn(problem._id) ? Math.floor(timer.elapsed() / 60) : 0;
  const spent = logged + live;

  const solved = progress.status === 'solved';
  const unlocked = solved || spent >= EDITORIAL_GATE_MINUTES;
  const left = Math.max(0, EDITORIAL_GATE_MINUTES - spent);

  if (!unlocked) {
    /*
      A button rather than a disabled anchor, and it stays focusable on purpose:
      the tooltip is the entire explanation of why a link you can see does
      nothing, and a control removed from the tab order cannot deliver it to
      anyone navigating by keyboard.
    */
    return (
      <button
        type="button"
        className={`cell-link editorial-locked ${className}`}
        title={`${left} more ${left === 1 ? 'minute' : 'minutes'} on this problem first. ${
          timer.isOn(problem._id)
            ? 'The clock is running.'
            : 'Start the clock from the attempt dialog and it counts.'
        }`}
        aria-label={`Locked — ${left} minutes of work left before this opens`}
        onClick={(e) => e.preventDefault()}
      >
        <IconLock size={11} />
      </button>
    );
  }

  return (
    <a
      className={`cell-link ${className}`}
      href={href}
      target="_blank"
      rel="noreferrer"
      title={title}
      /*
        Remembered locally so the next attempt logged against this problem
        arrives with `peeked` already ticked — see peeks.js. Not recorded once
        the problem is solved: opening the editorial to compare your answer with
        a better one is reading, not peeking, and counting it would make the
        statistic useless exactly where the app wants to encourage it.
      */
      onClick={() => !solved && notePeek(problem._id)}
    >
      {children}
    </a>
  );
}
