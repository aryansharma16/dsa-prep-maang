import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { practiceApi } from '../../api/index.js';
import { errorMessage } from '../../api/http.js';
import { useRoadmap } from '../../store/RoadmapContext.jsx';
import { useToast } from '../../store/ToastContext.jsx';
import { CodeEditor } from '../problem/SolutionEditor.jsx';
import { DEFAULT_LANG } from '../problem/attempts.js';
import { IconCheck, IconClock, IconExternal, IconPlay } from '../ui/Icons.jsx';

/**
 * A mock interview you can run alone.
 *
 * The Playbook asks for a timed mock every Saturday from week six, which without
 * this is nineteen Saturdays that need another person. So: two problems drawn at
 * random, one clock across both, no editorial and no video anywhere on the page,
 * an approach you must state before the code box unlocks, and a four-line rubric
 * at the end that you answer honestly.
 *
 * Nothing marks it. The four rubric lines are the things candidates actually
 * lose on — not clarifying, never stating complexity, never testing an example,
 * silently typing for forty minutes — and each is something you can answer about
 * yourself. What was missing was never the judgement; it was being made to sit
 * the exam.
 *
 * The forcing function is the locked code box. In a real round you say the
 * approach before you type, and typing first is the habit that loses it.
 */

const DEFAULT_COUNT = 2;
const DEFAULT_BUDGET = 45;

const pad = (n) => String(n).padStart(2, '0');
const clock = (seconds) => `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;

const RUBRIC = [
  { id: 'clarified', label: 'I asked about inputs, edge cases and constraints before starting' },
  { id: 'complexity', label: 'I stated the time and space complexity, unprompted' },
  { id: 'tested', label: 'I walked a real example through my code at the end' },
  { id: 'narrated', label: 'I talked the whole way through, including while stuck' },
];

export function Mock() {
  const { groups } = useRoadmap();
  const { toast, error: toastError } = useToast();

  const [phase, setPhase] = useState('idle'); // idle → running → scoring → done
  const [budget, setBudget] = useState(DEFAULT_BUDGET);
  const [picked, setPicked] = useState([]);
  const [answers, setAnswers] = useState({});
  const [rubric, setRubric] = useState({});
  const [startedAt, setStartedAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [saving, setSaving] = useState(false);
  const savedRef = useRef(false);

  /*
    Unsolved problems only. A mock on something you solved last week measures
    your memory of that problem rather than your interviewing, and there are 429
    to draw from — running out is not a concern worth designing around.
  */
  const pool = useMemo(
    () =>
      groups.flatMap((g) =>
        g.problems
          .filter((p) => (p.progress?.status || 'todo') !== 'solved')
          .map((p) => ({
            _id: p._id,
            title: p.title,
            difficulty: p.difficulty,
            url: p.url,
            pattern: g.name,
          })),
      ),
    [groups],
  );

  const elapsed = startedAt ? Math.floor((now - startedAt) / 1000) : 0;
  const left = Math.max(0, budget * 60 - elapsed);
  const over = elapsed > budget * 60;

  useEffect(() => {
    if (phase !== 'running') return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const start = () => {
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, DEFAULT_COUNT);
    setPicked(shuffled);
    setAnswers(
      Object.fromEntries(
        shuffled.map((p) => [p._id, { approach: '', code: '', lang: DEFAULT_LANG, finished: false }]),
      ),
    );
    setRubric({});
    savedRef.current = false;
    setStartedAt(Date.now());
    setNow(Date.now());
    setPhase('running');
  };

  const patch = (id, next) => setAnswers((a) => ({ ...a, [id]: { ...a[id], ...next } }));

  const save = useCallback(async () => {
    // The clock stops when you press Finish, not when the request lands, and a
    // double-click must not file the same session twice.
    if (savedRef.current) return;
    savedRef.current = true;
    setSaving(true);
    try {
      await practiceApi.saveMockRun({
        budgetMinutes: budget,
        minutes: Math.min(240, Math.round(elapsed / 60)),
        problems: picked.map((p) => ({ problem: p._id, ...answers[p._id] })),
        rubric,
      });
      toast('Mock saved.');
    } catch (err) {
      savedRef.current = false;
      toastError(errorMessage(err, 'Could not save that mock'));
    } finally {
      setSaving(false);
    }
  }, [budget, elapsed, picked, answers, rubric, toast, toastError]);

  if (phase === 'idle') {
    return (
      <section className="pr-panel">
        <span className="pr-eyebrow mono">MOCK INTERVIEW</span>
        <h2 className="pr-mock-title">Two problems, one clock, no answers</h2>
        <p className="pr-lead">
          Drawn at random from what you have not solved. The editorial and the walkthrough are not on
          this page at all, and the code box stays locked until you have written down the approach —
          because saying it before you type is the half of the round most people skip.
        </p>

        <div className="pr-mock-setup">
          <label className="field">
            <span>Minutes</span>
            <div className="size-group filter-seg">
              {[30, 45, 60].map((m) => (
                <button
                  key={m}
                  type="button"
                  className={budget === m ? 'on' : ''}
                  aria-pressed={budget === m}
                  onClick={() => setBudget(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </label>
          <button type="button" className="btn primary" onClick={start} disabled={pool.length < DEFAULT_COUNT}>
            <IconPlay size={13} /> Start
          </button>
        </div>

        {pool.length < DEFAULT_COUNT && (
          <p className="hint">
            You need at least {DEFAULT_COUNT} unsolved problems for a mock. Everything is solved —
            which is a good problem to have.
          </p>
        )}
      </section>
    );
  }

  if (phase === 'running') {
    return (
      <section className="pr-panel pr-mock">
        <header className={`pr-mock-head ${over ? 'over' : ''}`}>
          <span className="pr-mock-clock mono">
            <IconClock size={14} />
            {over ? `+${clock(elapsed - budget * 60)}` : clock(left)}
          </span>
          <span className="hint">
            {over ? 'Over time — a real round would have ended.' : `of ${budget} minutes`}
          </span>
          <span className="spacer" />
          <button type="button" className="btn" onClick={() => setPhase('scoring')}>
            Finish
          </button>
        </header>

        {picked.map((problem, i) => {
          const a = answers[problem._id];
          // The whole forcing function, in one boolean.
          const unlocked = a.approach.trim().length >= 20;

          return (
            <article className="pr-mock-q" key={problem._id}>
              <header>
                <span className="pr-mock-n mono">Q{i + 1}</span>
                <h3>{problem.title}</h3>
                <span className={`diff ${problem.difficulty}`}>{problem.difficulty}</span>
                {problem.url && (
                  <a className="cell-link" href={problem.url} target="_blank" rel="noreferrer" title="Read the statement">
                    <IconExternal size={12} />
                  </a>
                )}
              </header>

              <label className="pr-mock-approach">
                <span className="rev-label">Approach — say it before you write it</span>
                <textarea
                  rows={3}
                  value={a.approach}
                  maxLength={2000}
                  placeholder="What you would tell the interviewer: the idea, why it works, and the complexity."
                  onChange={(e) => patch(problem._id, { approach: e.target.value })}
                />
              </label>

              {unlocked ? (
                <CodeEditor
                  value={a.code}
                  lang={a.lang}
                  rows={12}
                  onChange={(code) => patch(problem._id, { code })}
                  onLang={(lang) => patch(problem._id, { lang })}
                  placeholder="Write it here. Nothing is run — this is the transcript, not a judge."
                />
              ) : (
                <p className="pr-mock-locked">
                  The code box opens once the approach is written down. A sentence or two is enough —
                  it is the habit that matters, not the essay.
                </p>
              )}

              <label className="check-row">
                <input
                  type="checkbox"
                  checked={a.finished}
                  onChange={(e) => patch(problem._id, { finished: e.target.checked })}
                />
                I got this one out
              </label>
            </article>
          );
        })}
      </section>
    );
  }

  if (phase === 'scoring') {
    return (
      <section className="pr-panel">
        <span className="pr-eyebrow mono">HOW DID IT GO</span>
        <h2 className="pr-mock-title">
          {clock(elapsed)} · {picked.filter((p) => answers[p._id].finished).length} of {picked.length}{' '}
          finished
        </h2>
        <p className="pr-lead">
          Four questions, answered honestly. These are the things people actually lose rounds on, and
          none of them is about the algorithm.
        </p>

        <ul className="pr-rubric">
          {RUBRIC.map((line) => (
            <li key={line.id}>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={Boolean(rubric[line.id])}
                  onChange={(e) => setRubric((r) => ({ ...r, [line.id]: e.target.checked }))}
                />
                {line.label}
              </label>
            </li>
          ))}
        </ul>

        <div className="pr-acts">
          <button
            type="button"
            className="btn primary"
            disabled={saving}
            onClick={async () => {
              await save();
              setPhase('done');
            }}
          >
            <IconCheck size={13} /> {saving ? 'Saving…' : 'Save this mock'}
          </button>
        </div>
      </section>
    );
  }

  const scored = RUBRIC.filter((l) => rubric[l.id]).length;
  return (
    <section className="pr-panel pr-result">
      <span className="pr-eyebrow mono">MOCK FINISHED</span>
      <h2 className="mono">
        {scored} / {RUBRIC.length}
        <span className="pr-pct">{clock(elapsed)}</span>
      </h2>
      {scored < RUBRIC.length && (
        <p className="pr-lead">
          Unticked lines are the practice for next Saturday:{' '}
          {RUBRIC.filter((l) => !rubric[l.id])
            .map((l) => l.label.replace(/^I /, '').replace(/,.*$/, ''))
            .join(' · ')}
          .
        </p>
      )}
      <div className="pr-acts">
        <button type="button" className="btn primary" onClick={() => setPhase('idle')}>
          Another
        </button>
      </div>
    </section>
  );
}
