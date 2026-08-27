import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { playbookApi } from '../api/index.js';
import { errorMessage } from '../api/http.js';
import { useToast } from './ToastContext.jsx';

const PlaybookContext = createContext(null);

const EMPTY = { startedAt: null, targetDate: null, done: [], notes: {} };

/**
 * The prep plan's stored state — start date, ticks, retro notes.
 *
 * Mounted on the route rather than around the tree, like CPProvider and for a
 * weaker version of the same reason: one person opens this page, nothing else
 * reads it, and a fetch on every session for a module almost nobody can see
 * would be a request spent on nothing.
 *
 * Every write is optimistic. A checkbox that waits for a round trip before it
 * fills in is a checkbox you stop trusting, and there is nothing here worth
 * being careful about — the worst case is a tick that comes back off, with the
 * toast saying why.
 */
export function PlaybookProvider({ children }) {
  const { error: toastError } = useToast();
  const [plan, setPlan] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let live = true;
    playbookApi
      .get()
      .then((data) => live && setPlan(data || EMPTY))
      .catch((err) => live && setLoadError(errorMessage(err, 'Could not load the plan')))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);

  /**
   * One PATCH, applied locally first and rolled back if the server disagrees.
   *
   * The server answers with the whole plan, so the success path replaces rather
   * than merges — which is what keeps a fast double-click from leaving the two
   * copies disagreeing about the second tick.
   */
  const send = useCallback(
    async (body, optimistic) => {
      const before = plan;
      if (optimistic) setPlan(optimistic);
      try {
        const next = await playbookApi.patch(body);
        setPlan(next);
      } catch (err) {
        setPlan(before);
        toastError(errorMessage(err, 'Could not save that'));
      }
    },
    [plan, toastError],
  );

  const done = useMemo(() => new Set(plan.done || []), [plan.done]);

  const toggle = useCallback(
    (id) => {
      const on = !done.has(id);
      const next = on ? [...(plan.done || []), id] : (plan.done || []).filter((x) => x !== id);
      send({ tick: { id, on } }, { ...plan, done: next });
    },
    [done, plan, send],
  );

  const setDates = useCallback(
    (patch) => send(patch, { ...plan, ...patch }),
    [plan, send],
  );

  const setNote = useCallback(
    (key, text) => {
      const notes = { ...(plan.notes || {}) };
      if (text.trim()) notes[key] = text;
      else delete notes[key];
      send({ note: { key, text } }, { ...plan, notes });
    },
    [plan, send],
  );

  const value = useMemo(
    () => ({
      plan,
      loading,
      loadError,
      isDone: (id) => done.has(id),
      doneCount: (ids) => ids.reduce((n, id) => n + (done.has(id) ? 1 : 0), 0),
      toggle,
      setDates,
      setNote,
    }),
    [plan, loading, loadError, done, toggle, setDates, setNote],
  );

  return <PlaybookContext.Provider value={value}>{children}</PlaybookContext.Provider>;
}

export function usePlaybook() {
  const ctx = useContext(PlaybookContext);
  if (!ctx) throw new Error('usePlaybook must be used inside PlaybookProvider');
  return ctx;
}
