import { useAttemptTimer } from '../store/AttemptTimerContext.jsx';
import { EDITORIAL_GATE_MINUTES } from '../components/problem/attempts.js';

/**
 * Have you earned the answer yet?
 *
 * Extracted from `EditorialLink`, which had this arithmetic inline. The SQL Lab
 * needs the same rule with entirely different chrome — it reveals a *panel*
 * rather than opening a link — and this repo argues at length for why the gate
 * is a hard block rather than a warning. A rule with that much reasoning behind
 * it deserves one implementation rather than two that agree today.
 *
 * ---------------------------------------------------------------------------
 * Why it is two numbers.
 *
 * `progress.attemptMinutes` is the sum of every sitting already logged against
 * this problem. It is computed server-side and rides along on every row, so it
 * is durable: it survives a closed browser, a different machine and a cleared
 * cache.
 *
 * The running clock is added on top, because the twenty-five minutes you are in
 * the middle of should count while you are in the middle of them — otherwise
 * the gate opens only after you stop and log, which is the wrong moment.
 *
 * The durable half is what makes a hard block survivable at all. Gating on the
 * live timer alone — localStorage, one problem at a time — would mean closing a
 * tab locks an answer you had genuinely earned.
 * ---------------------------------------------------------------------------
 *
 * A solved problem is never gated. You have earned it, and comparing your
 * answer against a better one is the most useful thing to do next.
 */
export function useEditorialGate(problemId, progress = {}) {
  const timer = useAttemptTimer();

  const logged = progress.attemptMinutes || 0;
  const live = timer.isOn(problemId) ? Math.floor(timer.elapsed() / 60) : 0;
  const spent = logged + live;

  const solved = progress.status === 'solved';
  const unlocked = solved || spent >= EDITORIAL_GATE_MINUTES;

  return {
    unlocked,
    solved,
    spent,
    minutesLeft: Math.max(0, EDITORIAL_GATE_MINUTES - spent),
    /** Whether the clock is running, so a locked message can say the right thing. */
    running: timer.isOn(problemId),
  };
}
