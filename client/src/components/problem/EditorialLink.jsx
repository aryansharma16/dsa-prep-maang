import { useEditorialGate } from '../../hooks/useEditorialGate.js';
import { IconLock } from '../ui/Icons.jsx';
import { notePeek } from './peeks.js';

/**
 * A link to somebody else's answer, behind twenty-five minutes.
 *
 * The editorial, the video walkthrough and the CP solution links all go through
 * this. It is the one deliberate piece of friction in the app, and it is a hard
 * block rather than a warning because minute four is exactly when a warning gets
 * clicked through — and minute four is where the learning would have been.
 *
 * The rule itself — what counts as time spent, and why it is two numbers — is
 * in `useEditorialGate`, shared with the SQL Lab's reference-solution panel.
 * Same gate, different chrome: this one guards a link out to somebody else's
 * site, that one guards a panel on the page.
 *
 * A solved problem is never gated. You have earned the answer, and comparing
 * your solution against a better one is the most useful thing you can do next.
 */
export function EditorialLink({ problem, progress = {}, href, title, className = '', children }) {
  const { unlocked, solved, minutesLeft: left, running } = useEditorialGate(problem._id, progress);

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
          running
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
