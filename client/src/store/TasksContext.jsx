import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { tasksApi } from '../api/index.js';
import { useAuth } from './AuthContext.jsx';
import { moduleVisible } from './modules.js';

/**
 * The one running clock, everywhere.
 *
 * This exists because of where the timer has to be visible rather than where it
 * is started. A timer you cannot see is a timer you forget to stop, and a
 * forgotten timer is the single thing that makes every number this feature
 * produces a lie — so the pill sits in the top bar on every page, which means
 * the state cannot live on the tasks page.
 *
 * It is deliberately not the whole board. The page owns its own tasks and
 * fetches them itself; this holds exactly one task and tells the page when it
 * changes. Hoisting the board here would mean every route paid for a request
 * only one of them renders.
 */

const TasksContext = createContext(null);

/** Above zero only while something is running, so idle pages do no work at all. */
const TICK_MS = 1000;

export function TasksProvider({ children }) {
  const { user, modules } = useAuth();
  const enabled = Boolean(user) && moduleVisible(modules, 'tasks');

  const [running, setRunning] = useState(null);
  const [ready, setReady] = useState(false);
  /*
    Bumped once a second while a clock runs. Its only job is to be part of the
    context value so consumers re-render — the elapsed number is computed, never
    stored, so there is nothing else for a tick to change.
  */
  const [tick, setTick] = useState(0);

  /**
   * How far this browser's clock is ahead of the server's, in milliseconds.
   *
   * `runningSince` is written by the server, and a laptop four minutes fast
   * would subtract it from its own "now" and show four extra minutes. Every
   * timer response carries the server's instant, so the offset is measured from
   * the same round trip that produced the timestamp.
   *
   * A ref, not state: it changes on every timer call and nothing should
   * re-render because the clocks were compared again.
   */
  const offset = useRef(0);

  /** Takes a `{ task, now }` from any timer endpoint and makes it the truth. */
  const adopt = useCallback((payload) => {
    if (payload?.now) offset.current = new Date(payload.now).getTime() - Date.now();
    const task = payload?.task;
    setRunning(task?.runningSince ? task : null);
    return task ?? null;
  }, []);

  useEffect(() => {
    if (!enabled) {
      setRunning(null);
      setReady(true);
      return undefined;
    }

    let live = true;
    tasksApi
      .timer()
      .then((payload) => {
        if (live) adopt(payload);
      })
      // A failed poll is not worth a toast. The pill simply does not appear,
      // and the next start or stop resolves it.
      .catch(() => {})
      .finally(() => {
        if (live) setReady(true);
      });

    return () => {
      live = false;
    };
  }, [enabled, adopt]);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), TICK_MS);
    return () => clearInterval(id);
  }, [running]);

  /**
   * Seconds on a running task, against the server's clock.
   *
   * Recomputed on every render rather than stored, which is what makes it
   * correct after a reload, in a second tab, and on a laptop that was asleep —
   * all three are just a different "now" applied to the same timestamp.
   */
  const elapsed = useCallback((task) => {
    if (!task?.runningSince) return 0;
    const now = Date.now() + offset.current;
    return Math.max(0, Math.round((now - new Date(task.runningSince).getTime()) / 1000));
  }, []);

  const start = useCallback(
    async (id) => adopt(await tasksApi.timerStart(id)),
    [adopt],
  );

  const stop = useCallback(async (id) => adopt(await tasksApi.timerStop(id)), [adopt]);

  /**
   * Told by the page that a task changed under it.
   *
   * The board can stop a clock without going through `stop` — dragging a card
   * into the done column does it server-side, and so does deleting one. Without
   * this the pill would keep counting a task that is no longer running, which
   * is exactly the failure the pill exists to prevent.
   *
   * A null task means "it is gone": clear the pill if that is what it was
   * showing.
   */
  const sync = useCallback((task, id = null) => {
    const changed = String(task?.id ?? id ?? '');
    setRunning((current) => {
      if (task?.runningSince) return task;
      if (!current) return null;
      return String(current.id) === changed ? null : current;
    });
  }, []);

  const value = useMemo(
    () => ({ running, ready, elapsed, start, stop, sync, tick }),
    [running, ready, elapsed, start, stop, sync, tick],
  );

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export const useTasks = () => {
  const value = useContext(TasksContext);
  if (!value) throw new Error('useTasks must be used inside TasksProvider');
  return value;
};
