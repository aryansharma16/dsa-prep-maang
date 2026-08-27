import { useCallback, useEffect, useMemo, useState } from 'react';
import { practiceApi } from '../../api/index.js';
import { errorMessage } from '../../api/http.js';
import { useRoadmap } from '../../store/RoadmapContext.jsx';
import { useToast } from '../../store/ToastContext.jsx';
import { IconCheck, IconClose, IconDice } from '../ui/Icons.jsx';

/**
 * The pattern drill.
 *
 * A problem's title, and six techniques. Pick the one it wants.
 *
 * This is the cheapest useful exercise in the app and it trains the thing that
 * actually decides a phone screen. An interview is won or lost in the first
 * ninety seconds, on recognising what shape the statement is — everything after
 * that is implementation you can already do. Re-solving trains the
 * implementation at twenty-five minutes a repetition; this trains the
 * recognition at about three seconds, so a minute here is twenty repetitions of
 * the skill that was failing.
 *
 * It needed no new content. Every one of the 429 problems already carries a
 * `patternSlug`, and the roadmap is already in memory — see `useRoadmap`.
 *
 * The one thing deliberately withheld is the topic tags. "Array, Hash Table"
 * sitting under the title would answer the question being asked, and a quiz you
 * cannot get wrong teaches nothing.
 */

/** Six options: the answer and five decoys. More is a reading exercise. */
const CHOICES = 6;

/** Fisher-Yates, so the answer is not always in the same slot. */
function shuffled(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function Drill() {
  const { groups, loading } = useRoadmap();
  const { error: toastError } = useToast();

  /** Every problem worth asking about, flattened once. */
  const pool = useMemo(
    () =>
      groups.flatMap((g) =>
        g.problems.map((p) => ({
          _id: p._id,
          title: p.title,
          difficulty: p.difficulty,
          slug: g.slug,
        })),
      ),
    [groups],
  );

  const patterns = useMemo(() => groups.map((g) => ({ slug: g.slug, name: g.name })), [groups]);
  const nameOf = useCallback(
    (slug) => patterns.find((p) => p.slug === slug)?.name || slug,
    [patterns],
  );

  const [question, setQuestion] = useState(null);
  const [answered, setAnswered] = useState(null);
  // Ids already asked this session, so a twenty-question run is twenty problems.
  const [seen, setSeen] = useState(() => new Set());
  const [score, setScore] = useState({ total: 0, correct: 0 });
  const [misses, setMisses] = useState([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const next = useCallback(() => {
    if (!pool.length || patterns.length < CHOICES) return;

    // Once everything has been asked the session wraps rather than ending — a
    // drill that stops at 429 is a drill nobody reaches the end of anyway.
    const fresh = pool.filter((p) => !seen.has(p._id));
    const problem = pick(fresh.length ? fresh : pool);

    const decoys = shuffled(patterns.filter((p) => p.slug !== problem.slug)).slice(0, CHOICES - 1);
    setQuestion({
      problem,
      options: shuffled([{ slug: problem.slug, name: nameOf(problem.slug) }, ...decoys]),
    });
    setAnswered(null);
  }, [pool, patterns, seen, nameOf]);

  useEffect(() => {
    if (!question && pool.length) next();
  }, [question, pool.length, next]);

  const answer = (slug) => {
    if (answered) return;
    const right = slug === question.problem.slug;

    setAnswered({ slug, right });
    setSeen((prev) => new Set(prev).add(question.problem._id));
    setScore((s) => ({ total: s.total + 1, correct: s.correct + (right ? 1 : 0) }));
    if (!right) setMisses((m) => [...m, { problem: question.problem._id, chose: slug }]);
  };

  /**
   * Stop, and record the run.
   *
   * One write, at the end. The session is shown as finished the moment you press
   * it rather than after the round trip — the numbers on screen are already
   * correct, and making you wait on a request to see a score you can read is the
   * kind of honesty nobody thanked anyone for.
   */
  const finish = async () => {
    if (!score.total) {
      setDone(true);
      return;
    }
    setSaving(true);
    setDone(true);
    try {
      await practiceApi.saveDrillRun({ ...score, misses });
    } catch (err) {
      toastError(errorMessage(err, 'Could not save that run'));
    } finally {
      setSaving(false);
    }
  };

  const restart = () => {
    setScore({ total: 0, correct: 0 });
    setMisses([]);
    setSeen(new Set());
    setDone(false);
    setQuestion(null);
  };

  /*
    Number keys answer, Enter moves on. The drill is a rhythm — the whole value
    is in how many repetitions fit in a minute — and reaching for the mouse
    between every question halves it.
  */
  useEffect(() => {
    if (done) return undefined;
    const onKey = (e) => {
      if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName) || e.target.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (answered && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        next();
        return;
      }
      const n = Number(e.key);
      if (!answered && n >= 1 && n <= CHOICES && question?.options[n - 1]) {
        e.preventDefault();
        answer(question.options[n - 1].slug);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (loading) return <div className="skeleton" style={{ height: 220 }} />;

  if (patterns.length < CHOICES) {
    return (
      <div className="empty">
        <h3>Not enough patterns to drill</h3>
        <p>The drill needs at least {CHOICES} patterns to build a question from.</p>
      </div>
    );
  }

  if (done) {
    const pct = score.total ? Math.round((score.correct / score.total) * 100) : 0;
    return (
      <section className="pr-panel pr-result">
        <span className="pr-eyebrow mono">RUN FINISHED</span>
        <h2 className="mono">
          {score.correct} / {score.total}
          <span className="pr-pct">{pct}%</span>
        </h2>

        {misses.length > 0 && (
          <>
            <p className="pr-lead">
              The ones you missed. A pattern you cannot name from the title is invisible everywhere
              else in this app — you never solved anything for it to be a low number in.
            </p>
            <ul className="pr-misses">
              {misses.map((m) => {
                const problem = pool.find((p) => p._id === m.problem);
                return (
                  <li key={m.problem}>
                    <span className="pr-miss-title">{problem?.title || 'A problem'}</span>
                    <span className="pr-miss-said">
                      you said <b>{nameOf(m.chose)}</b>
                    </span>
                    <span className="pr-miss-was">
                      it was <b>{nameOf(problem?.slug)}</b>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <div className="pr-acts">
          <button type="button" className="btn primary" onClick={restart}>
            <IconDice size={13} /> Go again
          </button>
          {saving && <span className="hint">Saving…</span>}
        </div>
      </section>
    );
  }

  if (!question) return <div className="skeleton" style={{ height: 220 }} />;

  return (
    <section className="pr-panel pr-drill">
      <header className="pr-drill-head">
        <span className="pr-eyebrow mono">WHICH PATTERN?</span>
        <span className="pr-score mono">
          {score.correct}/{score.total}
        </span>
      </header>

      <div className="pr-question">
        <h2>{question.problem.title}</h2>
        <span className={`diff ${question.problem.difficulty}`}>{question.problem.difficulty}</span>
      </div>

      <ol className="pr-options">
        {question.options.map((option, i) => {
          const isAnswer = option.slug === question.problem.slug;
          const chosen = answered?.slug === option.slug;
          /*
            After an answer the correct option is always marked, not just the one
            you picked. Being told "wrong" without being told what it was is the
            one way to make a drill actively useless.
          */
          const tone = !answered ? '' : isAnswer ? 'right' : chosen ? 'wrong' : 'dim';
          return (
            <li key={option.slug}>
              <button
                type="button"
                className={`pr-option ${tone}`}
                onClick={() => answer(option.slug)}
                disabled={Boolean(answered)}
              >
                <span className="pr-key mono">{i + 1}</span>
                <span className="pr-option-name">{option.name}</span>
                {answered && isAnswer && <IconCheck size={13} />}
                {answered && chosen && !isAnswer && <IconClose size={13} />}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="pr-acts">
        {answered ? (
          <button type="button" className="btn primary" onClick={next}>
            Next <kbd className="mono">↵</kbd>
          </button>
        ) : (
          <span className="hint">
            <kbd className="mono">1</kbd>–<kbd className="mono">{CHOICES}</kbd> to answer
          </span>
        )}
        <span className="spacer" />
        <button type="button" className="btn" onClick={finish} disabled={!score.total}>
          Finish
        </button>
      </div>
    </section>
  );
}
