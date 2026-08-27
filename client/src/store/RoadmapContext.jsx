import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { problemsApi, progressApi } from '../api/index.js';
import { errorMessage } from '../api/http.js';
import { outcomeOf } from '../components/problem/attempts.js';
import { useToast } from './ToastContext.jsx';

const RoadmapContext = createContext(null);

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

/**
 * The attempt summary the table draws, recomputed from a saved progress row.
 *
 * The write endpoints answer with the whole document, attempts and all, while
 * the roadmap ships only the tail — so this is where the two shapes are made
 * the same. The same four-attempt window as the aggregation in
 * server/src/controllers/problem.controller.js, for the same reason.
 */
const attemptSummary = (attempts = []) => ({
  attemptCount: attempts.length,
  attemptMinutes: attempts.reduce((n, a) => n + (a.minutes || 0), 0),
  recentAttempts: attempts.slice(-4),
});

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

  const logAttempt = useCallback(
    async (problemId, body) => {
      const before = snapshot(problemId);
      /*
        The same table the server decides by — see components/problem/attempts.js.
        It is mirrored rather than awaited so the row settles on the frame the
        dialog closes; the server's answer replaces all of this a moment later,
        and the only cost of the mirror being wrong is one frame of flicker.
      */
      const effect = outcomeOf(body.outcome);
      const attempt = {
        // No `_id` — the server mints that, and the chip this draws is replaced
        // by the real one as soon as the write lands.
        at: new Date().toISOString(),
        loggedAt: new Date().toISOString(),
        minutes: body.minutes,
        outcome: body.outcome,
        color: body.color || '',
        timed: Boolean(body.timed),
        confidence: body.confidence ?? null,
        note: body.note || '',
      };

      applyLocal(problemId, {
        // Not solving it does not un-solve it: an attempt says how one sitting
        // went, not what you know.
        status: effect.solves ? 'solved' : before.status === 'solved' ? 'solved' : 'attempted',
        needsRevision: effect.flagsRevision ? true : before.needsRevision,
        confidence: body.confidence ?? before.confidence,
        attemptCount: (before.attemptCount || 0) + 1,
        attemptMinutes: (before.attemptMinutes || 0) + (body.minutes || 0),
        // The window the column draws, with this sitting on the end of it.
        recentAttempts: [...(before.recentAttempts || []), attempt].slice(-4),
      });

      try {
        const saved = await progressApi.attempt(problemId, body);
        applyLocal(problemId, {
          status: saved.status,
          needsRevision: saved.needsRevision,
          confidence: saved.confidence,
          nextReviewAt: saved.nextReviewAt,
          solvedAt: saved.solvedAt,
          ...attemptSummary(saved.attempts || []),
        });
      } catch (err) {
        applyLocal(problemId, before);
        toastError(errorMessage(err, 'Could not log attempt — reverted'));
      }
    },
    [applyLocal, snapshot, toastError],
  );

  /**
   * An attempt was edited or removed in the log dialog.
   *
   * These exist here rather than being called straight off `progressApi` for
   * one reason: the table behind the dialog draws a chip per attempt, and a
   * dialog that quietly kept its edit to itself left the row showing the colour
   * you just changed and the sitting you just deleted until a reload.
   *
   * Both answer with the whole progress document, so the row is refreshed from
   * what the server actually stored rather than from what was asked for.
   *
   * Unlike `logAttempt` these let the error out instead of toasting it. The
   * caller is a dialog with a place to put a message, and a toast behind an
   * open modal is a message in the one place the reader is not looking.
   */
  const syncAttempts = useCallback(
    (problemId, saved) => {
      applyLocal(problemId, attemptSummary(saved.attempts || []));
      return saved;
    },
    [applyLocal],
  );

  const editAttempt = useCallback(
    async (problemId, attemptId, patch) =>
      syncAttempts(problemId, await progressApi.editAttempt(problemId, attemptId, patch)),
    [syncAttempts],
  );

  const deleteAttempt = useCallback(
    async (problemId, attemptId) =>
      syncAttempts(problemId, await progressApi.deleteAttempt(problemId, attemptId)),
    [syncAttempts],
  );

  /**
   * Working the revision queue.
   *
   * Answers true/false like `setProgress`, because its caller drops the row on
   * the way out and has to be able to put it back. The roadmap is updated too:
   * a recall moves the next-review date, and that is a column on the table.
   */
  const reviewProblem = useCallback(
    async (problemId, result, confidence, recall) => {
      const before = snapshot(problemId);
      try {
        const saved = await progressApi.review(problemId, result, confidence, recall);
        applyLocal(problemId, {
          status: saved.status,
          needsRevision: saved.needsRevision,
          confidence: saved.confidence,
          nextReviewAt: saved.nextReviewAt,
          solvedAt: saved.solvedAt,
        });
        return true;
      } catch (err) {
        applyLocal(problemId, before);
        toastError(errorMessage(err, 'Could not update the revision queue'));
        return false;
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
      editAttempt,
      deleteAttempt,
      reviewProblem,
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
      editAttempt,
      deleteAttempt,
      reviewProblem,
      addProblem,
      updateProblem,
      removeProblem,
    ],
  );

  return <RoadmapContext.Provider value={value}>{children}</RoadmapContext.Provider>;
}

export const useRoadmap = () => useContext(RoadmapContext);
