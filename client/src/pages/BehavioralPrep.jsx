import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '../api/http.js';
import { storiesApi } from '../api/index.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx';
import { Dropdown } from '../components/ui/Dropdown.jsx';
import {
  LPS,
  QUESTIONS,
  RATINGS,
  STAR,
  STYLES,
  TARGET_SECONDS,
  THEMES,
  COACH,
  sampleFromProfile,
  sampleFromStory,
  suggestStories,
} from '../interview/behavioral.js';
import { useAuth } from '../store/AuthContext.jsx';
import { useToast } from '../store/ToastContext.jsx';

/**
 * Interview Helper → Behavioral Prep.
 *
 * Three tabs on one screen:
 *   Practice   a question, a timer, the stories that fit it; rate the answer.
 *   Stories    your STAR stories (private to your account), with an editor.
 *   Questions  the whole bank, with how each one went last time, and which
 *              themes have no story yet.
 */
const themeLabel = Object.fromEntries(THEMES.map((t) => [t.id, t.label]));
const lpLabel = Object.fromEntries(LPS.map((l) => [l.id, l.label]));
const ratingLabel = Object.fromEntries(RATINGS.map((r) => [r.id, r.label]));
const qById = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const EMPTY_STORY = { title: '', themes: [], lps: [], questions: [], situation: '', task: '', action: '', result: '', learning: '', resumeBullet: '' };

/** Stories that can answer a question: most shared themes first, then fewest practised. */
/** Linked stories first; theme matches only when nothing is linked. */
const suggestFor = (question, stories) => {
  const { linked, closest } = suggestStories(question, stories);
  return { list: linked.length ? linked : closest, linked: linked.length > 0 };
};

const PROFILE_QUESTIONS = new Set(['open-intro', 'open-why', 'open-leave']);

/** What a strong answer does, for this question. */
function Guide({ question }) {
  const g = question.guide || {};
  if (!g.look) return null;
  return (
    <dl className="bp-guide">
      <div>
        <dt>They're testing</dt>
        <dd>{g.look}</dd>
      </div>
      <div>
        <dt>Angle</dt>
        <dd>{g.angle}</dd>
      </div>
      <div>
        <dt>Avoid</dt>
        <dd>{g.avoid}</dd>
      </div>
    </dl>
  );
}

/** The sample answer for a question: from your profile for openers, else from a story. */
const sampleFor = (question, story, user) =>
  PROFILE_QUESTIONS.has(question.id)
    ? sampleFromProfile(question, { name: user?.name, profile: user?.profile })
    : story
      ? sampleFromStory(question, story)
      : '';

/** Text with every [bracketed gap] highlighted, so what is left to fill stands out. */
function Gaps({ text }) {
  return text.split(/(\[[^\]]+\])/g).map((part, i) =>
    /^\[[^\]]+\]$/.test(part) ? (
      <mark key={i} className="bp-gap" title="Fill this in your story">
        {part.slice(1, -1)}
      </mark>
    ) : (
      part
    ),
  );
}

function CopyButton({ text }) {
  const { toast } = useToast();
  return (
    <button
      type="button"
      className="btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast('Copied', 'success');
        } catch {
          toast('Clipboard blocked', 'error');
        }
      }}
    >
      Copy
    </button>
  );
}

/* ------------------------------------------------------------------------ */
/* Practice                                                                  */
/* ------------------------------------------------------------------------ */

function Practice({ stories, setStories, practice, onLogged, startWith }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [view, setView] = useState('sample');
  const [style, setStyle] = useState('all');
  const [theme, setTheme] = useState('all');
  const [question, setQuestion] = useState(() => (startWith ? qById[startWith] : null));
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [storyId, setStoryId] = useState('');
  const [openStory, setOpenStory] = useState(null);
  const tick = useRef(null);

  const pool = useMemo(
    () =>
      QUESTIONS.filter(
        (q) => (style === 'all' || q.styles.includes(style)) && (theme === 'all' || q.themes.includes(theme)),
      ),
    [style, theme],
  );

  const next = useCallback(() => {
    if (!pool.length) return;
    // Favour questions you have not answered, or answered badly.
    const weight = (q) => {
      const last = practice.byQuestion[q.id]?.last;
      return !last ? 3 : last === 'rough' ? 2 : last === 'ok' ? 1 : 0.4;
    };
    const total = pool.reduce((n, q) => n + weight(q), 0);
    let r = Math.random() * total;
    let pick = pool[0];
    for (const q of pool) {
      r -= weight(q);
      if (r <= 0) {
        pick = q;
        break;
      }
    }
    setQuestion(pick);
    setSeconds(0);
    setRunning(false);
    setStoryId('');
    setOpenStory(null);
  }, [pool, practice.byQuestion]);

  useEffect(() => {
    if (!question) next();
  }, [question, next]);

  useEffect(() => {
    if (!running) return undefined;
    tick.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(tick.current);
  }, [running]);

  useEffect(() => {
    if (startWith && qById[startWith]) {
      setQuestion(qById[startWith]);
      setSeconds(0);
      setRunning(false);
    }
  }, [startWith]);

  const match = question ? suggestFor(question, stories) : { list: [], linked: false };
  const suggested = match.list;
  useEffect(() => {
    setOpenStory(suggested[0]?.id || null);
    // Only when the question changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id]);

  const rate = async (rating) => {
    setRunning(false);
    try {
      const res = await storiesApi.practice({ questionId: question.id, story: storyId || null, seconds, rating });
      onLogged(res.practice);
      toast(`Logged: ${ratingLabel[rating]}`, 'success');
      next();
    } catch (err) {
      toast(errorMessage(err, 'Could not save'), 'error');
    }
  };

  const pct = Math.min(100, Math.round((seconds / TARGET_SECONDS) * 100));
  const over = seconds > TARGET_SECONDS + 60;
  const last = question && practice.byQuestion[question.id];
  const shown = stories.find((s) => s.id === openStory);

  // "Yes, this story answers it": link it, so it is offered first from now on.
  const link = async (story) => {
    const questions = [...new Set([...(story.questions || []), question.id])];
    try {
      const { story: saved } = await storiesApi.update(story.id, { questions });
      setStories((list) => list.map((s) => (s.id === saved.id ? { ...s, ...saved } : s)));
      toast('Linked: this story now answers this question', 'success');
    } catch (err) {
      toast(errorMessage(err, 'Could not link it'), 'error');
    }
  };

  return (
    <div className="mb-body">
      <aside className="mb-side">
        <div className="mb-block">
          <span className="mb-label">Company style</span>
          <div className="mb-seg small">
            {[{ id: 'all', label: 'All' }, ...STYLES].map((s) => (
              <button key={s.id} type="button" className={style === s.id ? 'active' : ''} onClick={() => setStyle(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-block">
          <span className="mb-label">Theme</span>
          <Dropdown
            ariaLabel="Theme"
            value={theme}
            options={[{ value: 'all', label: 'Any theme' }, ...THEMES.map((t) => ({ value: t.id, label: t.label, note: t.hint }))]}
            onChange={setTheme}
          />
          <small className="bp-muted">{pool.length} questions match</small>
        </div>

        {question && (
          <div className="bp-question">
            <div className="bp-tags">
              {question.themes.map((t) => (
                <span key={t} className="bp-tag">
                  {themeLabel[t]}
                </span>
              ))}
              {question.lps.map((l) => (
                <span key={l} className="bp-tag lp" title={LPS.find((x) => x.id === l)?.hint}>
                  {lpLabel[l]}
                </span>
              ))}
            </div>
            <p className="bp-q">{question.text}</p>
            {last && (
              <small className="bp-muted">
                Last time: {ratingLabel[last.last]} · answered {last.count}×
              </small>
            )}

            <div className="bp-timer">
              <span className={`bp-time ${over ? 'over' : ''}`}>{mmss(seconds)}</span>
              <div className="bp-track" title={`Aim for about ${mmss(TARGET_SECONDS)}`}>
                <span style={{ width: `${pct}%` }} className={seconds > TARGET_SECONDS ? 'past' : ''} />
              </div>
              <button type="button" className="btn" onClick={() => setRunning((r) => !r)}>
                {running ? 'Pause' : seconds ? 'Resume' : 'Start'}
              </button>
            </div>
            <small className="bp-muted">Answer out loud. Aim for about 2–3 minutes.</small>

            <div className="mb-block">
              <span className="mb-label">Story you used</span>
              <Dropdown
                ariaLabel="Story used"
                value={storyId}
                options={[{ value: '', label: 'None / made it up live' }, ...stories.map((s) => ({ value: s.id, label: s.title }))]}
                onChange={setStoryId}
              />
            </div>

            <div className="bp-rate">
              {RATINGS.map((r) => (
                <button key={r.id} type="button" className={`bp-rate-btn ${r.id}`} onClick={() => rate(r.id)}>
                  {r.label}
                </button>
              ))}
            </div>
            <button type="button" className="mb-link" onClick={next}>
              Skip to another question →
            </button>
          </div>
        )}
      </aside>

      <section className="mb-out bp-right">
        {question && <Guide question={question} />}
        {question && PROFILE_QUESTIONS.has(question.id) ? (
          <>
            <div className="mb-out-bar">
              <span className="mb-label">Sample answer · from your profile</span>
              <CopyButton text={sampleFor(question, null, user)} />
            </div>
            <div className="bp-star-view">
              <p>
                <Gaps text={sampleFor(question, null, user)} />
              </p>
            </div>
          </>
        ) : suggested.length === 0 ? (
          <div className="bp-empty">
            <p>None of your stories answers this question yet. This is exactly the gap an interviewer will find.</p>
            {COACH[question?.id] && (
              <p className="bp-need">
                <b>Write a story that shows:</b> {COACH[question.id].fit}
              </p>
            )}
          </div>
        ) : (
          <>
            {COACH[question?.id] && (
              <div className={`bp-fit ${match.linked ? 'ok' : 'warn'}`}>
                {match.linked ? (
                  <span>
                    <b>Check it shows:</b> {COACH[question.id].fit}
                  </span>
                ) : (
                  <>
                    <span>
                      <b>Closest match by theme, not confirmed.</b> It only fits if it shows: {COACH[question.id].fit}
                    </span>
                    {shown && (
                      <button type="button" className="btn" onClick={() => link(shown)}>
                        This story answers it
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
            {/* Its own row: the view toggle and Copy, then the story chips under it. */}
            <div className="bp-pane-bar">
              <div className="mb-seg small bp-toggle" role="tablist" aria-label="View">
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'sample'}
                  className={view === 'sample' ? 'active' : ''}
                  onClick={() => setView('sample')}
                >
                  Sample answer
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'star'}
                  className={view === 'star' ? 'active' : ''}
                  onClick={() => setView('star')}
                >
                  STAR notes
                </button>
              </div>
              {shown && view === 'sample' && <CopyButton text={sampleFor(question, shown, user)} />}
            </div>
            <div className="bp-chips">
              <span className="bp-muted">{match.linked ? 'Your story:' : 'Closest:'}</span>
              {suggested.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`bp-chip ${openStory === s.id ? 'active' : ''}`}
                  onClick={() => setOpenStory(s.id)}
                >
                  {s.title}
                  {s.draft && <em>draft</em>}
                </button>
              ))}
            </div>
            {shown && view === 'sample' && (
              <div className="bp-star-view">
                <p>
                  <Gaps text={sampleFor(question, shown, user)} />
                </p>
              </div>
            )}
            {shown && view === 'star' && (
              <div className="bp-star-view">
                {STAR.map((part) =>
                  shown[part.key] ? (
                    <div key={part.key}>
                      <b>{part.label}</b>
                      <p>
                        <Gaps text={shown[part.key]} />
                      </p>
                    </div>
                  ) : null,
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Stories                                                                   */
/* ------------------------------------------------------------------------ */

function Stories({ stories, setStories }) {
  const { toast } = useToast();
  const [activeId, setActiveId] = useState(stories[0]?.id || 'new');
  const active = stories.find((s) => s.id === activeId);
  const [form, setForm] = useState(active || EMPTY_STORY);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setForm(active || EMPTY_STORY);
    // Reset only when switching stories.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const toggle = (key, value) =>
    setForm((f) => {
      const list = f[key] || [];
      return { ...f, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] };
    });

  const save = async (draft) => {
    setBusy(true);
    const body = {
      title: form.title,
      themes: form.themes,
      lps: form.lps,
      questions: form.questions || [],
      situation: form.situation,
      task: form.task,
      action: form.action,
      result: form.result,
      learning: form.learning,
      resumeBullet: form.resumeBullet,
      draft,
    };
    try {
      if (active) {
        const { story } = await storiesApi.update(active.id, body);
        setStories((list) => list.map((s) => (s.id === story.id ? { ...s, ...story } : s)));
      } else {
        const { story } = await storiesApi.create(body);
        setStories((list) => [story, ...list]);
        setActiveId(story.id);
      }
      toast(draft ? 'Saved as draft' : 'Story saved', 'success');
    } catch (err) {
      toast(errorMessage(err, 'Could not save'), 'error');
    }
    setBusy(false);
  };

  const remove = async () => {
    try {
      await storiesApi.remove(active.id);
      setStories((list) => list.filter((s) => s.id !== active.id));
      setActiveId('new');
      toast('Story deleted', 'success');
    } catch (err) {
      toast(errorMessage(err, 'Could not delete'), 'error');
    }
    setDeleting(false);
  };

  const words = (form.action || '').trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="mb-body">
      <aside className="mb-side">
        <button type="button" className="btn primary" onClick={() => setActiveId('new')}>
          + New story
        </button>
        <ul className="bp-list">
          {stories.map((s) => (
            <li key={s.id}>
              <button type="button" className={`bp-item ${activeId === s.id ? 'active' : ''}`} onClick={() => setActiveId(s.id)}>
                <b>
                  {s.title}
                  {s.draft && <em>draft</em>}
                </b>
                <small>
                  {s.themes.map((t) => themeLabel[t]).join(' · ') || 'No themes yet'}
                  {s.practised ? ` · used ${s.practised}×` : ''}
                </small>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="mb-out bp-editor">
        <div className="mb-out-bar">
          <input
            className="mb-subject bp-title"
            placeholder="Story title, e.g. Fixing double charges in payments"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            maxLength={120}
          />
          <div className="mb-actions">
            {active && (
              <button type="button" className="btn" onClick={() => setDeleting(true)}>
                Delete
              </button>
            )}
            <button type="button" className="btn" disabled={busy || !form.title.trim()} onClick={() => save(true)}>
              Save draft
            </button>
            <button type="button" className="btn primary" disabled={busy || !form.title.trim()} onClick={() => save(false)}>
              Save
            </button>
          </div>
        </div>

        <div className="bp-scroll">
          <div className="bp-row">
            <span className="mb-label">Themes</span>
            <div className="bp-chips">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  title={t.hint}
                  className={`bp-chip ${form.themes.includes(t.id) ? 'active' : ''}`}
                  onClick={() => toggle('themes', t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="bp-row">
            <span className="mb-label">Amazon Leadership Principles</span>
            <div className="bp-chips">
              {LPS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  title={l.hint}
                  className={`bp-chip small ${form.lps.includes(l.id) ? 'active' : ''}`}
                  onClick={() => toggle('lps', l.id)}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <div className="bp-row">
            <span className="mb-label">
              Answers these questions <small>Only tick the ones this story really answers; they are offered first in Practice.</small>
            </span>
            <div className="bp-qpick">
              {QUESTIONS.filter(
                (q) =>
                  !['open-intro', 'open-why', 'open-leave'].includes(q.id) &&
                  ((form.questions || []).includes(q.id) || form.themes.includes(q.themes[0])),
              ).map((q) => (
                <label key={q.id} className={(form.questions || []).includes(q.id) ? 'on' : ''}>
                  <input
                    type="checkbox"
                    checked={(form.questions || []).includes(q.id)}
                    onChange={() => toggle('questions', q.id)}
                  />
                  {q.text}
                </label>
              ))}
              {!form.themes.length && <small className="bp-muted">Pick themes above to see matching questions.</small>}
            </div>
          </div>
          <label className="bp-field">
            <span className="mb-label">Resume bullet it backs up</span>
            <input
              className="mb-input"
              maxLength={300}
              value={form.resumeBullet}
              onChange={(e) => setForm((f) => ({ ...f, resumeBullet: e.target.value }))}
            />
          </label>
          {STAR.map((part) => (
            <label key={part.key} className="bp-field">
              <span className="mb-label">
                {part.label} <small>{part.hint}</small>
                {part.key === 'action' && <small className={words > 220 ? 'warn' : ''}> · {words} words</small>}
              </span>
              <textarea
                className="bp-textarea"
                rows={part.key === 'action' ? 6 : 3}
                maxLength={part.key === 'action' ? 3000 : 1500}
                value={form[part.key]}
                onChange={(e) => setForm((f) => ({ ...f, [part.key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
      </section>

      {deleting && (
        <ConfirmDialog
          title="Delete this story?"
          message={`"${active.title}" will be deleted. Practice history stays.`}
          confirmLabel="Delete"
          tone="danger"
          onConfirm={remove}
          onCancel={() => setDeleting(false)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Questions + coverage                                                      */
/* ------------------------------------------------------------------------ */

function Questions({ stories, practice, onPractise }) {
  const { user } = useAuth();
  const [openId, setOpenId] = useState(null);
  const coverage = THEMES.map((t) => ({ ...t, n: stories.filter((s) => s.themes.includes(t.id)).length }));
  return (
    <div className="mb-body">
      <aside className="mb-side">
        <span className="mb-label">Coverage: stories per theme</span>
        <ul className="bp-coverage">
          {coverage.map((c) => (
            <li key={c.id} className={c.n === 0 ? 'gap' : ''} title={c.hint}>
              <span>{c.label}</span>
              <b>{c.n}</b>
            </li>
          ))}
        </ul>
        <small className="bp-muted">Aim for at least one story per theme; two for ownership, conflict and failure.</small>
      </aside>
      <section className="mb-out">
        <div className="mb-out-bar">
          <span className="mb-label">{QUESTIONS.length} questions</span>
        </div>
        <ul className="bp-qlist">
          {QUESTIONS.map((q) => {
            const last = practice.byQuestion[q.id];
            const open = openId === q.id;
            const m = suggestFor(q, stories);
            const best = m.list[0];
            const sample = sampleFor(q, best, user);
            return (
              <li key={q.id} className={open ? 'open' : ''}>
                <button
                  type="button"
                  className="bp-qtoggle"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : q.id)}
                  title={open ? 'Hide the sample answer' : 'Show the guide and a sample answer'}
                >
                  {open ? '▾' : '▸'}
                </button>
                <div>
                  <p>{q.text}</p>
                  <small>
                    {q.themes.map((t) => themeLabel[t]).join(' · ')} · {q.styles.map((s) => STYLES.find((x) => x.id === s)?.label).join(', ')}
                  </small>
                </div>
                {last ? <span className={`bp-last ${last.last}`}>{ratingLabel[last.last]}</span> : <span className="bp-last none">New</span>}
                <button type="button" className="btn" onClick={() => onPractise(q.id)}>
                  Practise
                </button>
                {open && (
                  <div className="bp-qdetail">
                    <Guide question={q} />
                    <div className="mb-out-bar">
                      <span className="mb-label">
                        Sample answer
                        {PROFILE_QUESTIONS.has(q.id)
                          ? ' · from your profile'
                          : best
                            ? ` · ${m.linked ? 'from' : 'closest match, not confirmed:'} "${best.title}"`
                            : ''}
                      </span>
                      {sample && <CopyButton text={sample} />}
                    </div>
                    {sample ? (
                      <p className="bp-sample">
                        <Gaps text={sample} />
                      </p>
                    ) : (
                      <p className="bp-muted">
                        No story answers this yet. Write one that shows: {COACH[q.id]?.fit || 'a specific example for this question.'}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

const TABS = [
  { id: 'practice', label: 'Practice' },
  { id: 'stories', label: 'Stories' },
  { id: 'questions', label: 'Questions' },
];

export function BehavioralPrep() {
  const [tab, setTab] = useState('practice');
  const [stories, setStories] = useState(null);
  const [practice, setPractice] = useState({ total: 0, recent: [], byQuestion: {} });
  const [error, setError] = useState('');
  const [startWith, setStartWith] = useState(null);

  useEffect(() => {
    storiesApi
      .list()
      .then((res) => {
        setStories(res.stories);
        setPractice(res.practice);
      })
      .catch((err) => setError(errorMessage(err, 'Could not load your stories')));
  }, []);

  const onLogged = (p) => {
    setPractice((prev) => ({
      total: prev.total + 1,
      recent: [p, ...prev.recent].slice(0, 30),
      byQuestion: {
        ...prev.byQuestion,
        [p.questionId]: { last: p.rating, count: (prev.byQuestion[p.questionId]?.count || 0) + 1, at: p.at },
      },
    }));
    if (p.story) setStories((list) => list.map((s) => (s.id === p.story ? { ...s, practised: s.practised + 1 } : s)));
  };

  const gaps = stories ? THEMES.filter((t) => !stories.some((s) => s.themes.includes(t.id))).length : 0;

  return (
    <div className="mb">
      <header className="mb-head">
        <div>
          <h1>Behavioral Prep</h1>
          <p>
            Your STAR stories, a question bank and timed practice for Amazon LP, Google, Meta and general behavioural rounds.
            {stories && ` ${stories.length} stories · ${practice.total} answers practised${gaps ? ` · ${gaps} themes with no story` : ''}.`}
          </p>
        </div>
        <div className="mb-seg" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {error ? (
        <p className="bp-empty">{error}</p>
      ) : !stories ? (
        <p className="bp-empty">Loading…</p>
      ) : tab === 'practice' ? (
        <Practice stories={stories} setStories={setStories} practice={practice} onLogged={onLogged} startWith={startWith} />
      ) : tab === 'stories' ? (
        <Stories stories={stories} setStories={setStories} />
      ) : (
        <Questions
          stories={stories}
          practice={practice}
          onPractise={(id) => {
            setStartWith(id);
            setTab('practice');
          }}
        />
      )}
    </div>
  );
}
