import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { problemsApi, progressApi } from '../api/index.js';
import { errorMessage } from '../api/http.js';
import { useToast } from './ToastContext.jsx';

const RoadmapContext = createContext(null);

const emptyProgress = {
  status: 'todo',
  flagged: false,
  needsRevision: false,
  confidence: 3,
  notes: '',
  attemptCount: 0,
};

const countSolved = (problems) =>
  problems.reduce((n, p) => n + (p.progress?.status === 'solved' ? 1 : 0), 0);

export function RoadmapProvider({ children }) {
  const { error: toastError } = useToast();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await problemsApi.roadmap();
      setGroups(data.groups);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err, 'Could not load problems'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Replaces one problem's progress everywhere and refreshes its group count. */
  const applyLocal = useCallback((problemId, patch) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (!g.problems.some((p) => p._id === problemId)) return g;
        const problems = g.problems.map((p) =>
          p._id === problemId
            ? { ...p, progress: { ...emptyProgress, ...p.progress, ...patch } }
            : p,
        );
        return { ...g, problems, solved: countSolved(problems) };
      }),
    );
  }, []);

  const snapshot = useCallback(
    (problemId) => {
      for (const g of groups) {
        const p = g.problems.find((x) => x._id === problemId);
        if (p) return p.progress ? { ...p.progress } : { ...emptyProgress };
      }
      return { ...emptyProgress };
    },
    [groups],
  );

  /**
   * Writes locally first so the row responds on the same frame, then persists.
   * A failed request rolls the row back rather than leaving the UI lying.
   */
  const setProgress = useCallback(
    async (problemId, patch) => {
      const before = snapshot(problemId);
      applyLocal(problemId, patch);
      try {
        const saved = await progressApi.patch(problemId, patch);
        applyLocal(problemId, {
          status: saved.status,
          flagged: saved.flagged,
          needsRevision: saved.needsRevision,
          confidence: saved.confidence,
          notes: saved.notes,
          nextReviewAt: saved.nextReviewAt,
          solvedAt: saved.solvedAt,
          attemptCount: saved.attempts?.length ?? before.attemptCount,
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

  const logAttempt = useCallback(
    async (problemId, body) => {
      const before = snapshot(problemId);
      const stuck = body.outcome === 'stuck';
      applyLocal(problemId, {
        // Getting stuck on something already solved does not un-solve it — mirror
        // the server's rule so the row doesn't flicker back and forth.
        status: stuck ? (before.status === 'solved' ? 'solved' : 'attempted') : 'solved',
        needsRevision: stuck ? true : before.needsRevision,
        attemptCount: (before.attemptCount || 0) + 1,
      });
      try {
        const saved = await progressApi.attempt(problemId, body);
        applyLocal(problemId, {
          status: saved.status,
          needsRevision: saved.needsRevision,
          confidence: saved.confidence,
          nextReviewAt: saved.nextReviewAt,
          solvedAt: saved.solvedAt,
          attemptCount: saved.attempts?.length ?? 0,
        });
      } catch (err) {
        applyLocal(problemId, before);
        toastError(errorMessage(err, 'Could not log attempt — reverted'));
      }
    },
    [applyLocal, snapshot, toastError],
  );

  const addProblem = useCallback(async (body) => {
    const problem = await problemsApi.create(body);
    setGroups((prev) =>
      prev.map((g) => {
        if (g.slug !== problem.patternSlug) return g;
        const problems = [...g.problems, problem];
        // Recount rather than +1 — a problem can be added already solved.
        return { ...g, problems, total: problems.length, solved: countSolved(problems) };
      }),
    );
    return problem;
  }, []);

  /**
   * Saves an edit to one of your own problems.
   *
   * The row is replaced rather than patched, because the server may have moved
   * it: changing the pattern changes `patternSlug` and `patternOrder`, so the
   * problem has to leave one group and join another. Progress is carried across
   * by hand — the update endpoint answers with the problem, which knows nothing
   * about whether you have solved it.
   */
  const updateProblem = useCallback(async (problemId, body) => {
    const saved = await problemsApi.update(problemId, body);
    setGroups((prev) =>
      prev.map((g) => {
        const existing = g.problems.find((p) => p._id === problemId);

        if (existing && g.slug !== saved.patternSlug) {
          const problems = g.problems.filter((p) => p._id !== problemId);
          return { ...g, problems, total: problems.length, solved: countSolved(problems) };
        }

        if (g.slug !== saved.patternSlug) return g;

        const next = { ...saved, progress: existing?.progress };
        const problems = existing
          ? g.problems.map((p) => (p._id === problemId ? next : p))
          : [...g.problems, next];
        return { ...g, problems, total: problems.length, solved: countSolved(problems) };
      }),
    );
    return saved;
  }, []);

  const removeProblem = useCallback(
    async (problemId) => {
      try {
        await problemsApi.remove(problemId);
        setGroups((prev) =>
          prev.map((g) => {
            if (!g.problems.some((p) => p._id === problemId)) return g;
            const problems = g.problems.filter((p) => p._id !== problemId);
            return { ...g, problems, total: problems.length, solved: countSolved(problems) };
          }),
        );
      } catch (err) {
        toastError(errorMessage(err, 'Could not delete'));
      }
    },
    [toastError],
  );

  const totals = useMemo(
    () =>
      groups.reduce(
        (acc, g) => ({ total: acc.total + g.total, solved: acc.solved + g.solved }),
        { total: 0, solved: 0 },
      ),
    [groups],
  );

  const value = useMemo(
    () => ({
      groups,
      totals,
      loading,
      loadError,
      reload: load,
      setProgress,
      logAttempt,
      addProblem,
      updateProblem,
      removeProblem,
    }),
    [
      groups,
      totals,
      loading,
      loadError,
      load,
      setProgress,
      logAttempt,
      addProblem,
      updateProblem,
      removeProblem,
    ],
  );

  return <RoadmapContext.Provider value={value}>{children}</RoadmapContext.Provider>;
}

export const useRoadmap = () => useContext(RoadmapContext);
