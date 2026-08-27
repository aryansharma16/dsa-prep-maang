import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { cpApi } from '../api/index.js';
import { errorMessage } from '../api/http.js';
import { outcomeOf } from '../components/problem/attempts.js';
import { useToast } from './ToastContext.jsx';
import { clearCPLadder, publishCPLadder } from './cpLadderCache.js';

const CPContext = createContext(null);

const emptyProgress = {
  status: 'todo',
  flagged: false,
  needsRevision: false,
  confidence: 3,
  notes: '',
  attemptCount: 0,
  attemptMinutes: 0,
  recentAttempts: [],
  solvedOnPlatform: false,
};

/**
 * The CP ladder, and everything that writes to it.
 *
 * The same shape as RoadmapContext — optimistic local write, then persist, then
 * roll back on failure — because that is what makes a status toggle respond on
 * the frame it was clicked, and a ladder that felt slower than the roadmap
 * would be a worse version of a thing that already exists.
 *
 * What differs is the store: a flat array of problems plus the tier and pattern
 * metadata, rather than a pre-grouped tree. The page offers two groupings of the
 * same rows and a toggle between them has to be instant, so the grouping is
 * derived in the page from this list rather than shipped from the server.
 */

/**
 * The attempt summary the table draws, recomputed from a saved progress row.
 *
 * The write endpoints answer with the whole document, attempts and all, while
 * the ladder ships only the tail — so this is where the two shapes are made the
 * same. Same four-attempt window as the server's projection, for the same
 * reason.
 */
const attemptSummary = (attempts = []) => ({
  attemptCount: attempts.length,
  attemptMinutes: attempts.reduce((n, a) => n + (a.minutes || 0), 0),
  recentAttempts: attempts.slice(-4),
});

export function CPProvider({ children }) {
  const { error: toastError } = useToast();

  const [problems, setProblems] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      /*
        Both in one round trip's worth of wall clock. The profile is a small
        query and the ladder is a large one, and the arena header cannot draw
        its rating until the first has landed — waiting for them in sequence
        would leave the header blank for the whole of the second.
      */
      const [ladder, profileData] = await Promise.all([
        cpApi.ladder(),
        cpApi.profile().catch(() => ({ profile: null })),
      ]);
      setProblems(ladder.problems);
      setTiers(ladder.tiers);
      setPatterns(ladder.patterns);
      setProfile(profileData.profile);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err, 'Could not load the ladder'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /*
    Publish the ladder for the chat problem picker, which lives in the app shell
    beside this route rather than inside it — see store/cpLadderCache.js.
    Cleared on unmount so navigating away cannot leave the picker offering
    problems from a page that is no longer open.
  */
  useEffect(() => {
    publishCPLadder(problems);
  }, [problems]);

  useEffect(() => clearCPLadder, []);

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

  /**
   * Writes locally first so the row responds on the same frame, then persists.
   * A failed request rolls the row back rather than leaving the UI lying.
   */
  const setProgress = useCallback(
    async (problemId, patch) => {
      const before = snapshot(problemId);
      applyLocal(problemId, patch);
      try {
        const saved = await cpApi.patch(problemId, patch);
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
        Mirrored rather than awaited so the row settles on the frame the dialog
        closes; the server's answer replaces all of it a moment later, and the
        only cost of the mirror being wrong is one frame of flicker.
      */
      const effect = outcomeOf(body.outcome);
      const attempt = {
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
        recentAttempts: [...(before.recentAttempts || []), attempt].slice(-4),
      });

      try {
        const saved = await cpApi.attempt(problemId, body);
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
   * Unlike `logAttempt` these let the error out instead of toasting it. The
   * caller is a dialog with a place to put a message, and a toast behind an open
   * modal is a message in the one place the reader is not looking.
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
      syncAttempts(problemId, await cpApi.editAttempt(problemId, attemptId, patch)),
    [syncAttempts],
  );

  const deleteAttempt = useCallback(
    async (problemId, attemptId) =>
      syncAttempts(problemId, await cpApi.deleteAttempt(problemId, attemptId)),
    [syncAttempts],
  );

  const reviewProblem = useCallback(
    async (problemId, result, confidence) => {
      const before = snapshot(problemId);
      try {
        const saved = await cpApi.review(problemId, result, confidence);
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
    const problem = await cpApi.create(body);
    setProblems((prev) => [...prev, problem]);
    return problem;
  }, []);

  const updateProblem = useCallback(async (problemId, body) => {
    const saved = await cpApi.update(problemId, body);
    setProblems((prev) =>
      prev.map((p) => (p._id === problemId ? { ...saved, progress: p.progress } : p)),
    );
    return saved;
  }, []);

  const removeProblem = useCallback(
    async (problemId) => {
      try {
        await cpApi.remove(problemId);
        setProblems((prev) => prev.filter((p) => p._id !== problemId));
      } catch (err) {
        toastError(errorMessage(err, 'Could not delete'));
      }
    },
    [toastError],
  );

  const setHandle = useCallback(async (handle) => {
    const saved = await cpApi.setHandle(handle);
    setProfile(saved);
    return saved;
  }, []);

  /**
   * Pull accepted submissions from Codeforces onto the ladder.
   *
   * Reloads the whole ladder afterwards rather than patching rows locally. A
   * sync can touch hundreds of problems at once and the server decides which —
   * mirroring that in the client would mean reimplementing "never downgrade" on
   * this side, and getting it subtly different is exactly how a note goes
   * missing.
   */
  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await cpApi.sync();
      setProfile(result.profile);
      const ladder = await cpApi.ladder();
      setProblems(ladder.problems);
      setTiers(ladder.tiers);
      setPatterns(ladder.patterns);
      return result;
    } finally {
      setSyncing(false);
    }
  }, []);

  /*
    Recomputed from the rows rather than taken from the response, so the counters
    move the moment a status is toggled instead of on the next load. The server's
    totals are the same arithmetic over the same rows.
  */
  const totals = useMemo(() => {
    let solved = 0;
    let attempted = 0;
    let onPlatform = 0;
    for (const p of problems) {
      const status = p.progress?.status || 'todo';
      if (status === 'solved') solved += 1;
      else if (status === 'attempted') attempted += 1;
      if (p.progress?.solvedOnPlatform) onPlatform += 1;
    }
    return { total: problems.length, solved, attempted, onPlatform };
  }, [problems]);

  const value = useMemo(
    () => ({
      problems,
      tiers,
      patterns,
      profile,
      totals,
      loading,
      loadError,
      syncing,
      reload: load,
      setProgress,
      logAttempt,
      editAttempt,
      deleteAttempt,
      reviewProblem,
      addProblem,
      updateProblem,
      removeProblem,
      setHandle,
      sync,
    }),
    [
      problems,
      tiers,
      patterns,
      profile,
      totals,
      loading,
      loadError,
      syncing,
      load,
      setProgress,
      logAttempt,
      editAttempt,
      deleteAttempt,
      reviewProblem,
      addProblem,
      updateProblem,
      removeProblem,
      setHandle,
      sync,
    ],
  );

  return <CPContext.Provider value={value}>{children}</CPContext.Provider>;
}

export const useCP = () => useContext(CPContext);
