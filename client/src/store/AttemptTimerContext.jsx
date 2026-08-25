import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocalState } from '../hooks/useLocalState.js';

/**
 * The stopwatch you start before opening a problem.
 *
 * It is a context and not dialog state for the reason the task timer is: you
 * start it, close the dialog, and go and solve the thing. A clock that only
 * runs while its dialog is open would measure the dialog.
 *
 * Unlike the task timer this one is *local*. A task's tracked seconds are a
 * property of a server object that outlives the tab; a problem's are a
 * measurement in flight, meaningful only until you log the attempt it belongs
 * to — at which point it becomes `minutes` on an attempt and the server owns it
 * from there. Keeping it in localStorage means no model, no endpoint and no
 * round trip per tick, and costs exactly one thing: a clock started on the
 * laptop is not running on the phone. That is the right trade for a
 * measurement whose whole life is one sitting.
 *
 * Because it is anchored to a wall-clock instant rather than counting ticks, a
 * reload, a sleeping laptop and a background tab all come back with the right
 * number instead of however many intervals the browser felt like firing.
 */

const AttemptTimerContext = createContext(null);

const STORAGE_KEY = 'attempt-timer';
const TICK_MS = 1000;

/**
 * Twelve hours, the same cap the task timer takes. A clock left running
 * overnight is the one way this feature produces a number that is a lie, and
 * an attempt is capped at 600 minutes by the API anyway.
 */
const MAX_SECONDS = 12 * 60 * 60;

/** `{ problemId, title, startedAt, banked, paused }` — or null when idle. */
const emptyTimer = null;

export function AttemptTimerProvider({ children }) {
  const [timer, setTimer] = useLocalState(STORAGE_KEY, emptyTimer);
  /*
    Bumped once a second while the clock runs. Its only job is to be part of the
    context value, and it has to be *in* that value rather than merely bumped
    beside it: the elapsed number is computed and never stored, so a tick
    changes nothing else the memo below depends on, the value comes out
    referentially identical, and every consumer skips the render. The interval
    runs, the provider re-renders, and the clock on screen sits at 0:00.
  */
  const [tick, setTick] = useState(0);

  const live = Boolean(timer && !timer.paused);

  useEffect(() => {
    if (!live) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), TICK_MS);
    return () => clearInterval(id);
  }, [live]);

  /**
   * Seconds on the clock: what was banked by earlier pauses, plus the run in
   * progress. Recomputed every render, which is what makes it right after a
   * reload rather than after a reload plus however long the tab was gone.
   */
  const elapsed = useCallback((value = timer) => {
    if (!value) return 0;
    const running = value.paused ? 0 : Math.round((Date.now() - value.startedAt) / 1000);
    return Math.min(MAX_SECONDS, Math.max(0, (value.banked || 0) + running));
  }, [timer]);

  /** Starts a fresh clock on this problem, replacing whatever was on another. */
  const start = useCallback(
    (problemId, title) =>
      setTimer({ problemId, title, startedAt: Date.now(), banked: 0, paused: false }),
    [setTimer],
  );

  /** Banks the run in progress and holds. `resume` starts a new run from there. */
  const pause = useCallback(() => {
    setTimer((current) => {
      if (!current || current.paused) return current;
      const banked = Math.round((Date.now() - current.startedAt) / 1000) + (current.banked || 0);
      return { ...current, banked: Math.min(MAX_SECONDS, banked), paused: true };
    });
  }, [setTimer]);

  const resume = useCallback(() => {
    setTimer((current) =>
      current?.paused ? { ...current, startedAt: Date.now(), paused: false } : current,
    );
  }, [setTimer]);

  const reset = useCallback(() => setTimer(emptyTimer), [setTimer]);

  /** True for the one problem the clock is on, so a row can mark itself. */
  const isOn = useCallback((problemId) => Boolean(timer) && timer.problemId === problemId, [timer]);

  const value = useMemo(
    () => ({ timer, running: live, elapsed, isOn, start, pause, resume, reset, tick }),
    [timer, live, elapsed, isOn, start, pause, resume, reset, tick],
  );

  return <AttemptTimerContext.Provider value={value}>{children}</AttemptTimerContext.Provider>;
}

export const useAttemptTimer = () => useContext(AttemptTimerContext);
