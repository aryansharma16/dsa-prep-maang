import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { errorMessage } from '../api/http.js';
import { sqlApi } from '../api/index.js';
import { outcomeOf } from '../components/problem/attempts.js';
import { useToast } from './ToastContext.jsx';

/**
 * The SQL Lab's rows, and the writes against them.
 *
 * `CPContext` in shape, for the reason that file gives: someone who has read
 * one of these can read the other. Optimistic write, then persist, then roll
 * back on failure — a row responds on the frame you clicked it, and a failed
 * request puts it back rather than leaving the page lying about what was saved.
 *
 * Mounted on the route rather than around the tree. The bank is a hundred and
 * twenty statements and nothing outside `/sql` reads them, so fetching it for
 * someone who never opens the Lab would be bytes spent on nothing.
 */

const SqlContext = createContext(null);

const emptyProgress = {
  status: 'todo',
  flagged: false,
  needsRevision: false,
  confidence: 3,
  notes: '',
  attemptCount: 0,
  attemptMinutes: 0,
  recentAttempts: [],
};

const attemptSummary = (attempts = []) => ({
  attemptCount: attempts.length,
  attemptMinutes: attempts.reduce((n, a) => n + (a.minutes || 0), 0),
  recentAttempts: attempts.slice(-4),
});

export function SqlProvider({ children }) {
  const [problems, setProblems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [difficulties, setDifficulties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const { error: toastError } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const bank = await sqlApi.bank();
      setProblems(bank.problems);
      setCategories(bank.categories);
      setDifficulties(bank.difficulties);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err, 'Could not load the bank'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Replaces one problem's progress in place. */
  const applyLocal = useCallback((problemId, patch) => {
    setProblems((prev) =>
      prev.map((p) =>
        p._id === problemId ? { ...p, progress: { ...emptyProgress, ...p.progress, ...patch } } : p,
      ),
    );
  }, []);

  const snapshot = useCallback(
    (problemId) => {
      const p = problems.find((x) => x._id === problemId);
      return p?.progress ? { ...p.progress } : { ...emptyProgress };
    },
    [problems],
  );

  const setProgress = useCallback(
    async (problemId, patch) => {
      const before = snapshot(problemId);
      applyLocal(problemId, patch);
      try {
        const saved = await sqlApi.patch(problemId, patch);
        applyLocal(problemId, {
          status: saved.status,
          flagged: saved.flagged,
          needsRevision: saved.needsRevision,
          confidence: saved.confidence,
          notes: saved.notes,
          nextReviewAt: saved.nextReviewAt,
          solvedAt: saved.solvedAt,
          ...(saved.attempts ? attemptSummary(saved.attempts) : {}),
        });
        return true;
      } catch (err) {
        applyLocal(problemId, before);
        toastError(errorMessage(err, 'Could not save — change reverted'));
        return false;
      }
    },
    [applyLocal, snapshot, toastError],
  );

  /**
   * A query passed, so the row is solved.
   *
   * Applied locally first like everything else, and the rollback is the
   * interesting part: if the request fails, the row goes back to `attempted`
   * rather than staying green. A page that says "solved" over a request that
   * never landed is worse than one that admits it — the whole value of this
   * module is that its "solved" means something.
   */
  const markSolved = useCallback(
    async (problemId, query, ms) => {
      const before = snapshot(problemId);
      applyLocal(problemId, { status: 'solved', needsRevision: false });
      try {
        const saved = await sqlApi.solved(problemId, query, ms);
        applyLocal(problemId, {
          status: saved.status,
          solvedAt: saved.solvedAt,
          nextReviewAt: saved.nextReviewAt,
          needsRevision: false,
        });
        return saved;
      } catch (err) {
        applyLocal(problemId, before);
        toastError(errorMessage(err, 'The query was right, but saving it failed'));
        return null;
      }
    },
    [applyLocal, snapshot, toastError],
  );

  const logAttempt = useCallback(
    async (problemId, body) => {
      const before = snapshot(problemId);
      const effect = outcomeOf(body.outcome);
      const now = new Date().toISOString();

      applyLocal(problemId, {
        /* Not solving it does not un-solve it: an attempt says how one sitting went. */
        status: effect.solves ? 'solved' : before.status === 'solved' ? 'solved' : 'attempted',
        needsRevision: effect.flagsRevision ? true : before.needsRevision,
        confidence: body.confidence ?? before.confidence,
        attemptCount: (before.attemptCount || 0) + 1,
        attemptMinutes: (before.attemptMinutes || 0) + (body.minutes || 0),
        recentAttempts: [
          ...(before.recentAttempts || []),
          {
            at: now,
            loggedAt: now,
            minutes: body.minutes,
            outcome: body.outcome,
            color: body.color || '',
            timed: Boolean(body.timed),
            confidence: body.confidence ?? null,
            note: body.note || '',
          },
        ].slice(-4),
      });

      try {
        const saved = await sqlApi.attempt(problemId, body);
        applyLocal(problemId, {
          status: saved.status,
          needsRevision: saved.needsRevision,
          confidence: saved.confidence,
          solvedAt: saved.solvedAt,
          nextReviewAt: saved.nextReviewAt,
          ...attemptSummary(saved.attempts || []),
        });
        return true;
      } catch (err) {
        applyLocal(problemId, before);
        toastError(errorMessage(err, 'Could not log that sitting'));
        return false;
      }
    },
    [applyLocal, snapshot, toastError],
  );

  /*
    These two let the error escape rather than toasting it: the caller is a
    modal with its own message slot, and a toast behind an open dialog is the
    wrong place for the one message that dialog exists to deliver.
  */
  const syncAttempts = useCallback(
    (problemId, saved) => {
      applyLocal(problemId, attemptSummary(saved.attempts || []));
      return saved;
    },
    [applyLocal],
  );

  const editAttempt = useCallback(
    async (problemId, attemptId, body) =>
      syncAttempts(problemId, await sqlApi.editAttempt(problemId, attemptId, body)),
    [syncAttempts],
  );

  const deleteAttempt = useCallback(
    async (problemId, attemptId) =>
      syncAttempts(problemId, await sqlApi.deleteAttempt(problemId, attemptId)),
    [syncAttempts],
  );

  /**
   * Counts recomputed from the rows rather than taken from the response, so
   * the category rail moves the instant a problem is solved instead of after
   * the next reload.
   */
  const totals = useMemo(() => {
    let solved = 0;
    let attempted = 0;
    for (const p of problems) {
      const status = p.progress?.status || 'todo';
      if (status === 'solved') solved += 1;
      else if (status === 'attempted') attempted += 1;
    }
    return { total: problems.length, solved, attempted };
  }, [problems]);

  const liveCategories = useMemo(() => {
    const counts = new Map(categories.map((c) => [c.slug, { total: 0, solved: 0 }]));
    for (const p of problems) {
      const bucket = counts.get(p.category);
      if (!bucket) continue;
      bucket.total += 1;
      if (p.progress?.status === 'solved') bucket.solved += 1;
    }
    return categories.map((c) => ({ ...c, ...counts.get(c.slug) }));
  }, [categories, problems]);

  const liveDifficulties = useMemo(() => {
    const counts = new Map(difficulties.map((d) => [d.slug, { total: 0, solved: 0 }]));
    for (const p of problems) {
      const bucket = counts.get(p.difficulty);
      if (!bucket) continue;
      bucket.total += 1;
      if (p.progress?.status === 'solved') bucket.solved += 1;
    }
    return difficulties.map((d) => ({ ...d, ...counts.get(d.slug) }));
  }, [difficulties, problems]);

  const value = useMemo(
    () => ({
      problems,
      categories: liveCategories,
      difficulties: liveDifficulties,
      totals,
      loading,
      loadError,
      reload: load,
      setProgress,
      markSolved,
      logAttempt,
      editAttempt,
      deleteAttempt,
    }),
    [
      problems,
      liveCategories,
      liveDifficulties,
      totals,
      loading,
      loadError,
      load,
      setProgress,
      markSolved,
      logAttempt,
      editAttempt,
      deleteAttempt,
    ],
  );

  return <SqlContext.Provider value={value}>{children}</SqlContext.Provider>;
}

export const useSql = () => useContext(SqlContext);
