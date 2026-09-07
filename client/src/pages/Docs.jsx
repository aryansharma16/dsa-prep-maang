import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BRAND } from '../brand.js';
import { useAuth } from '../store/AuthContext.jsx';
import { ParticleWeb } from '../components/layout/ParticleWeb.jsx';
import { clock } from '../components/tasks/time.js';
import {
  IconArrowLeft,
  IconBook,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconFlag,
  IconNote,
  IconPause,
  IconPlay,
  IconRotate,
} from '../components/ui/Icons.jsx';

/**
 * What this app is and how to use it — the page for people using Ember rather
 * than building it.
 *
 * Public, and mounted on both sides of the auth branch in App.jsx, because the
 * reader who most needs it is the one who has not signed up yet.
 *
 * It is built on one idea: a guide to a tool should let you *work* the tool.
 * Every mechanic that is awkward to describe — what an outcome does to a row,
 * what the stopwatch actually feels like, how much a confidence rating moves
 * the revision date — is a thing you can operate here instead of a paragraph
 * claiming it. The prose is around the demos, not instead of them.
 *
 * Nothing on this page fetches, and nothing it does touches your account. The
 * rows below are props, not `Progress`.
 */

/* -------------------------------------------------------------------------- */
/* motion                                                                      */
/* -------------------------------------------------------------------------- */

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Fades and lifts its children in the first time they are scrolled to.
 *
 * Once, never on the way back up: an element that re-animates every time it
 * crosses the fold turns scrolling back to re-read something into a flicker.
 * With reduced motion on, it renders shown and never observes anything.
 */
function Reveal({ children, className = '', delay = 0 }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(prefersReducedMotion);

  useEffect(() => {
    if (shown || typeof IntersectionObserver !== 'function') {
      setShown(true);
      return undefined;
    }
    const el = ref.current;
    if (!el) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [shown]);

  return (
    <div
      ref={ref}
      className={`docs-reveal ${shown ? 'in' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/**
 * The page's scroll position, 0–100.
 *
 * Signed in the page scrolls inside `.content` rather than the window, so the
 * container has to be found rather than assumed — reading `window.scrollY` in
 * the shell gives a bar that never moves.
 */
function useScrollProgress() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const box = document.querySelector('.content');
    const target = box || window;

    const read = () => {
      const top = box ? box.scrollTop : window.scrollY;
      const max = box
        ? box.scrollHeight - box.clientHeight
        : document.documentElement.scrollHeight - window.innerHeight;
      setPct(max > 8 ? Math.min(100, Math.max(0, (top / max) * 100)) : 0);
    };

    read();
    target.addEventListener('scroll', read, { passive: true });
    window.addEventListener('resize', read);
    return () => {
      target.removeEventListener('scroll', read);
      window.removeEventListener('resize', read);
    };
  }, []);

  return pct;
}

/** Counts up to `to` once it is on screen. Jumps straight there if motion is off. */
function Counter({ to, suffix = '' }) {
  const [n, setN] = useState(prefersReducedMotion() ? to : 0);
  const ref = useRef(null);

  useEffect(() => {
    if (prefersReducedMotion() || typeof IntersectionObserver !== 'function') {
      setN(to);
      return undefined;
    }
    const el = ref.current;
    if (!el) return undefined;

    let raf = 0;
    let start = 0;
    const DURATION = 1100;

    const step = (now) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / DURATION);
      // Cubic ease-out: fast enough to feel immediate, slow enough at the end
      // that the final number lands rather than snaps.
      setN(Math.round(to * (1 - (1 - t) ** 3)));
      if (t < 1) raf = requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer.disconnect();
        raf = requestAnimationFrame(step);
      }
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to]);

  return (
    <span ref={ref} className="mono">
      {n}
      {suffix}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* content                                                                     */
/* -------------------------------------------------------------------------- */

/*
  A hue per section, drawn from the palette the task board's columns already
  use. It is not decoration: ten sections of identical grey headings read as one
  undifferentiated wall, and the colour is what lets you find the part you were
  reading when you come back to the page. See the [data-hue] rules in tokens.css.
*/
const SECTIONS = [
  { id: 'start', label: 'Your first hour', hue: 'amber', eyebrow: 'Start here' },
  { id: 'roadmap', label: 'The roadmap', hue: 'blue', eyebrow: 'The main screen' },
  { id: 'attempts', label: 'Logging an attempt', hue: 'orange', eyebrow: 'The heart of it' },
  { id: 'revision', label: 'Revision', hue: 'violet', eyebrow: 'Not forgetting' },
  { id: 'reading', label: 'Guides & Learn', hue: 'teal', eyebrow: 'The material' },
  { id: 'sql', label: 'SQL Lab', hue: 'pink', eyebrow: 'The other language' },
  { id: 'procoder', label: 'Pro Coder', hue: 'lime', eyebrow: 'Competitive programming' },
  /*
    Last of the five curriculum sections and first in importance, which is why
    it is here rather than at the top: a plan is only readable once you know
    what it is scheduling. Everything above this point is a thing you can do;
    this is the answer to "in what order, for how long, starting when".
  */
  { id: 'playbook', label: 'The Playbook', hue: 'indigo', eyebrow: 'The plan' },
  { id: 'assistant', label: 'Assistant & Tasks', hue: 'fuchsia', eyebrow: 'Help and planning' },
  { id: 'stats', label: 'Stats', hue: 'green', eyebrow: 'The honest view' },
  { id: 'yours', label: 'Making it yours', hue: 'sky', eyebrow: 'Setup' },
  { id: 'keys', label: 'Shortcuts', hue: 'slate', eyebrow: 'Faster' },
  { id: 'wrong', label: 'If it looks wrong', hue: 'red', eyebrow: 'Troubleshooting' },
];

const FIRST_HOUR = [
  ['Open the roadmap', 'It is the front page. The first section, Arrays & Hashing, is already open.'],
  [
    'Read the pattern guide first',
    'Every pattern has one. Read it before you solve anything in that section — this is the whole idea of the app.',
  ],
  ['Solve the first problem', 'Click the title to open it on LeetCode.'],
  [
    'Come back and log it',
    'Click the clock on the row. Say how long it took and how it went. This is the habit everything else depends on.',
  ],
  [
    'Mark it solved',
    'The circle in the first column cycles as you click it. Logging an attempt usually does this for you.',
  ],
];

/*
  Mirrors OUTCOMES in components/problem/attempts.js, which mirrors the server's
  own table. Written out rather than imported: the wording that belongs in a
  chip 24px tall is not the wording that belongs on a page explaining what the
  chip does, and `does` here is a sentence rather than two booleans.
*/
const OUTCOMES = [
  {
    value: 'solved',
    label: 'Solved',
    tone: 'good',
    solves: true,
    revisit: false,
    means: 'Got it on your own',
    does: 'Marks it solved and pushes the next review further out.',
  },
  {
    value: 'hints',
    label: 'With hints',
    tone: 'mid',
    solves: true,
    revisit: false,
    means: 'Needed a nudge — a hint, a tag, the discussion',
    does: 'Still counts as solved. The schedule moves on as normal.',
  },
  {
    value: 'video',
    label: 'After video',
    tone: 'mid',
    solves: true,
    revisit: true,
    means: 'Watched the walkthrough, then wrote it',
    does: 'Solved and flagged. A problem you needed the solution for is not one you know yet.',
  },
  {
    value: 'partial',
    label: 'Partial',
    tone: 'bad',
    solves: false,
    revisit: true,
    means: 'Brute force only, or it did not pass',
    does: 'Leaves it attempted and flags it for revision.',
  },
  {
    value: 'stuck',
    label: 'Stuck',
    tone: 'bad',
    solves: false,
    revisit: true,
    means: 'No real progress',
    does: 'Leaves it attempted and flags it for revision.',
  },
];

const ROADMAP_KEYS = [
  { keys: ['j'], match: ['j'], what: 'down a problem' },
  { keys: ['k'], match: ['k'], what: 'up a problem' },
  { keys: ['s'], match: ['s'], what: 'toggle solved' },
  { keys: ['f'], match: ['f'], what: 'flag' },
  { keys: ['r'], match: ['r'], what: 'needs revision' },
  { keys: ['n'], match: ['n'], what: 'notes' },
  { keys: ['o'], match: ['o'], what: 'open in a new tab' },
  { keys: ['/'], match: ['/'], what: 'search' },
  { keys: ['Esc'], match: ['escape'], what: 'close anything open' },
];

const TROUBLE = [
  [
    'A change did not stick',
    'Every change is written to the screen first and saved in the background. A failed save rolls the row back and says so — if you saw no error, it saved.',
  ],
  [
    'An attempt says locked but 30 minutes have not passed',
    'Hover it. The tooltip says which kind of locked it is.',
  ],
  [
    'A timer is running on something you do not recognise',
    'The pill in the top bar names the problem. Click it to log the attempt, or the square to throw the time away.',
  ],
  [
    'You lost your place',
    'Sections remember whether you left them open. Search with / if you know the title.',
  ],
];

/* -------------------------------------------------------------------------- */
/* the demos                                                                   */
/* -------------------------------------------------------------------------- */

const STATUS_ORDER = ['todo', 'attempted', 'solved'];
const STATUS_WORD = { todo: 'Not started', attempted: 'Attempted', solved: 'Solved' };

/** The status circle, exactly as it behaves on a row — click it and watch. */
function TryStatus() {
  const [status, setStatus] = useState('todo');
  const next = () => setStatus((s) => STATUS_ORDER[(STATUS_ORDER.indexOf(s) + 1) % 3]);

  return (
    <div className="docs-try docs-try-status">
      <button
        type="button"
        className={`status-btn ${status} docs-status-demo`}
        onClick={next}
        aria-label={`Status: ${STATUS_WORD[status]}. Click to change.`}
      >
        {status === 'solved' && <IconCheck size={11} />}
      </button>
      <div className="docs-try-say">
        <b>{STATUS_WORD[status]}</b>
        <span>Click it. That is the whole control.</span>
      </div>
    </div>
  );
}

/**
 * A real stopwatch, so "start it and walk away" is something you have done
 * before you read the sentence describing it.
 *
 * Its own state and its own interval — deliberately not the app's timer, which
 * belongs to a problem and to an account. Nothing here is recorded anywhere.
 */
function TryTimer() {
  const [startedAt, setStartedAt] = useState(null);
  const [banked, setBanked] = useState(0);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!startedAt) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [startedAt]);

  const seconds = banked + (startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0);
  const minutes = seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : 0;

  return (
    <div className={`docs-clockbox ${startedAt ? 'live' : ''}`}>
      <span className="docs-clock mono">{clock(seconds)}</span>

      <div className="docs-clock-acts">
        <button
          type="button"
          className="btn sm"
          onClick={() => {
            if (startedAt) {
              setBanked((b) => b + Math.floor((Date.now() - startedAt) / 1000));
              setStartedAt(null);
            } else {
              setStartedAt(Date.now());
            }
          }}
        >
          {startedAt ? <IconPause size={10} /> : <IconPlay size={10} />}
          {startedAt ? 'Pause' : seconds ? 'Resume' : 'Start'}
        </button>
        <button
          type="button"
          className="btn sm"
          onClick={() => {
            setStartedAt(null);
            setBanked(0);
          }}
        >
          <IconRotate size={10} /> Reset
        </button>
      </div>

      <p className="docs-clock-say">
        {seconds === 0 ? (
          <>In the app this keeps running after you close the dialog.</>
        ) : (
          <>
            Logs as <b>{minutes}m</b>, marked <span className="docs-chip">timed</span> — because it
            was measured rather than guessed.
          </>
        )}
      </p>
    </div>
  );
}

/**
 * The outcome table, as the thing itself.
 *
 * This is the one mechanic in the app that a table genuinely fails to teach:
 * "flags it for revision" is a phrase, and watching the flag light up on a row
 * you just changed is a fact. Pick an outcome and the row above answers.
 */
function TryOutcome() {
  const [picked, setPicked] = useState(null);
  const [log, setLog] = useState([]);
  const outcome = OUTCOMES.find((o) => o.value === picked);

  const status = !outcome ? 'todo' : outcome.solves ? 'solved' : 'attempted';

  const choose = (o) => {
    setPicked(o.value);
    setLog((rows) => [...rows.slice(-3), { tone: o.tone, mins: 10 + rows.length * 12 }]);
  };

  return (
    <div className="docs-demo">
      <div className="docs-demo-head">
        <span className="docs-demo-label">Try it</span>
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setPicked(null);
            setLog([]);
          }}
        >
          Reset
        </button>
      </div>

      {/* A roadmap row, drawn at rest. Not a screenshot — the same classes the
          real table uses, so it cannot drift from what it is illustrating. */}
      <div className="docs-row">
        <span className={`status-btn ${status} docs-row-status`} aria-hidden="true">
          {status === 'solved' && <IconCheck size={11} />}
        </span>
        <span className="docs-row-index mono">01</span>
        <span className="docs-row-title">Two Sum</span>
        <span className="diff Easy">Easy</span>

        <span className="docs-row-chips">
          {log.map((chip, i) => (
            <span className={`docs-chip ${chip.tone} pop`} key={`${chip.tone}-${i}`}>
              {chip.mins}m
            </span>
          ))}
        </span>

        <span className="docs-row-acts">
          <span className="act" aria-hidden="true">
            <IconFlag size={13} />
          </span>
          <span
            className={`act rev ${outcome?.revisit ? 'on' : ''}`}
            title={outcome?.revisit ? 'Flagged for revision' : 'Not flagged'}
          >
            <IconRotate size={13} />
          </span>
          <span className="act" aria-hidden="true">
            <IconClock size={13} />
          </span>
          <span className="act" aria-hidden="true">
            <IconNote size={13} />
          </span>
        </span>
      </div>

      <div className="docs-outcome-picks">
        {OUTCOMES.map((o) => (
          <button
            type="button"
            key={o.value}
            className={`docs-outcome-btn ${o.tone} ${picked === o.value ? 'on' : ''}`}
            onClick={() => choose(o)}
          >
            <b>{o.label}</b>
            <span>{o.means}</span>
          </button>
        ))}
      </div>

      <p className="docs-demo-say" aria-live="polite">
        {outcome ? (
          <>
            <span className={`docs-verdict ${outcome.tone}`}>{outcome.label}</span>
            {outcome.does}
          </>
        ) : (
          'Pick one and watch the row. The circle is the status; the second icon is the revision flag.'
        )}
      </p>
    </div>
  );
}

const LADDER = [3, 7, 21, 60];
/** The curve from server/src/services/review.service.js, not an approximation. */
const MULTIPLIER = { 1: 0.4, 2: 0.7, 3: 1, 4: 1.4, 5: 2 };

/**
 * The revision ladder, with the confidence dial actually attached to it.
 *
 * "Multiplied by your confidence" is a sentence people skim. Dragging a 3 down
 * to a 1 and watching sixty days collapse to twenty-four is the same fact,
 * arriving as a surprise.
 */
function TryLadder() {
  const [confidence, setConfidence] = useState(3);
  const mult = MULTIPLIER[confidence];
  const days = LADDER.map((base) => Math.max(1, Math.round(base * mult)));
  const widest = days[days.length - 1];

  return (
    <div className="docs-demo">
      <div className="docs-demo-head">
        <span className="docs-demo-label">Try it</span>
        <span className="docs-mult mono">×{mult}</span>
      </div>

      <div className="docs-ladder">
        {days.map((d, i) => (
          <div
            className={`docs-rung ${i === days.length - 1 ? 'last' : ''}`}
            key={LADDER[i]}
            style={{ flexGrow: Math.max(1, (d / widest) * 10) }}
          >
            <b>{d}</b>
            <span>{d === 1 ? 'day' : 'days'}</span>
          </div>
        ))}
      </div>

      <div className="docs-conf-row">
        {/* On the *solve*, specifically. A review is answered with one of four
            buttons now and does not read this dial — see the section below. */}
        <span className="docs-conf-label">How confident did you feel solving it?</span>
        <span className="confidence">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={`conf-dot ${n <= confidence ? 'on' : ''}`}
              onClick={() => setConfidence(n)}
              aria-label={`Confidence ${n} of 5`}
              title={`${n} of 5 — ×${MULTIPLIER[n]}`}
            />
          ))}
        </span>
      </div>

      <p className="docs-demo-say">
        {confidence <= 2 ? (
          <>Shaky, so it comes back fast — the first review is in {days[0]} days.</>
        ) : confidence === 3 ? (
          <>The default. Straight up the ladder: {days.join(' → ')} days.</>
        ) : (
          <>You know it, so it gets out of your way — the last gap stretches to {days[3]} days.</>
        )}
      </p>
    </div>
  );
}

/** The shortcut list, wired to the keyboard. Press one and it answers. */
function TryKeys() {
  const [hit, setHit] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA)$/.test(e.target.tagName) || e.target.isContentEditable;
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();
      const row = ROADMAP_KEYS.find((r) => r.match.includes(key));
      if (!row) return;

      setHit(row.keys[0]);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setHit(null), 700);
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(timer.current);
    };
  }, []);

  return (
    <>
      <div className="docs-keys">
        {ROADMAP_KEYS.map((row) => (
          <div className={`docs-key ${hit === row.keys[0] ? 'hit' : ''}`} key={row.keys[0]}>
            <span className="docs-key-caps">
              {row.keys.map((k) => (
                <kbd key={k}>{k}</kbd>
              ))}
            </span>
            {row.what}
          </div>
        ))}
      </div>
      <p className="docs-demo-say">
        Press one now — this list is listening. In the app they are off while you are typing in a
        field or while a dialog is open.
      </p>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* the page                                                                    */
/* -------------------------------------------------------------------------- */

function useCurrentSection(ids) {
  const [current, setCurrent] = useState(ids[0]);
  const visible = useRef({});

  useEffect(() => {
    if (typeof IntersectionObserver !== 'function') return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          visible.current[entry.target.id] = entry.isIntersecting;
        });
        const first = ids.find((id) => visible.current[id]);
        if (first) setCurrent(first);
      },
      { rootMargin: '-12% 0px -70% 0px' },
    );

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids]);

  return current;
}

function Section({ meta, children }) {
  return (
    <section id={meta.id} data-hue={meta.hue}>
      <Reveal>
        <span className="docs-eyebrow">
          <i className="docs-eyebrow-dot" />
          {meta.eyebrow}
        </span>
        <h2>{meta.label}</h2>
      </Reveal>
      {children}
    </section>
  );
}

const byId = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));

export function Docs() {
  const { user } = useAuth();
  const ids = useMemo(() => SECTIONS.map((s) => s.id), []);
  const current = useCurrentSection(ids);
  const progress = useScrollProgress();

  const jump = useCallback((e, id) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start',
    });
  }, []);

  return (
    <div className={`docs ${user ? '' : 'docs-public'}`}>
      {/* How far through you are. The only fixed thing on the page. */}
      <div className="docs-progress" aria-hidden="true">
        <span style={{ transform: `scaleX(${progress / 100})` }} />
      </div>

      {!user && (
        <div className="docs-bar">
          <Link to="/login" className="docs-bar-brand">
            <span className="brand-mark">{BRAND.mark}</span>
            {BRAND.name}
          </Link>
          <span className="spacer" />
          <Link to="/login" className="btn">
            Sign in
          </Link>
          <Link to="/register" className="btn primary">
            Start your journey
          </Link>
        </div>
      )}

      <div className="docs-shell">
        {/*
          The hero is the app's own metaphor rather than a picture of it: the
          web behind the sign-in form is a breadth-first search, drawn at rest,
          which is a pattern this curriculum spends a section on.
        */}
        <header className="docs-hero">
          <ParticleWeb className="docs-hero-web" />
          <div className="docs-hero-veil" aria-hidden="true" />

          <div className="docs-hero-inner">
            <div className="docs-hero-copy">
            <div className="docs-kind">
              <IconBook size={13} />
              Field guide
            </div>

            <h1>
              <span className="docs-h1-line">Learn the pattern.</span>
              <span className="docs-h1-line docs-h1-accent">
                Then the problems are practice.
              </span>
            </h1>

            <p className="docs-standfirst">
              Everything {BRAND.name} does, in the order you will actually need it. No setup, no
              code — and most of it you can try on this page before you sign in.
            </p>

            <div className="docs-stats">
              <div>
                <b>
                  <Counter to={517} />
                </b>
                <span>problems</span>
              </div>
              <div>
                <b>
                  <Counter to={23} />
                </b>
                <span>patterns, in teaching order</span>
              </div>
              <div>
                <b>
                  <Counter to={205} />
                </b>
                <span>reference topics</span>
              </div>
            </div>

            <div className="docs-hero-acts">
              {user ? (
                <Link to="/" className="btn primary docs-cta">
                  <IconArrowLeft size={13} />
                  Back to the course
                </Link>
              ) : (
                <Link to="/register" className="btn primary docs-cta">
                  Start your journey
                  <IconChevronRight size={13} />
                </Link>
              )}
              <a href="#start" className="btn" onClick={(e) => jump(e, 'start')}>
                Read the guide
              </a>
            </div>
            </div>

            {/*
              The thesis of the whole guide, drawn rather than claimed: one
              problem, three sittings, and the shape of them is the thing worth
              reading. Inert — it is the only picture on the page, and every
              other demo below is the real control instead.
            */}
            <div className="docs-hero-card" aria-hidden="true">
              <div className="docs-hero-card-row">
                <span className="status-btn solved">
                  <IconCheck size={11} />
                </span>
                <span className="mono docs-hero-card-idx">01</span>
                <span className="docs-hero-card-title">Two Sum</span>
                <span className="diff Easy">Easy</span>
              </div>

              <div className="docs-hero-card-head">
                <span>Attempt log</span>
                <span className="mono">3 · 1h 27m</span>
              </div>

              {[
                ['25 Aug', 'Stuck', 'bad', '45m'],
                ['26 Aug', 'Hints', 'mid', '30m'],
                ['28 Aug', 'Solved', 'good', '12m'],
              ].map(([day, label, tone, mins], i) => (
                <div
                  className={`docs-hero-log ${tone}`}
                  key={day}
                  style={{ '--log-delay': `${520 + i * 130}ms` }}
                >
                  <span className="docs-hero-log-day">{day}</span>
                  <span className={`docs-chip ${tone}`}>{label}</span>
                  <span className="mono docs-hero-log-mins">{mins}</span>
                </div>
              ))}

              <p className="docs-hero-card-say">45m → 30m → 12m. That is the shape.</p>
            </div>
          </div>
        </header>

        <p className="docs-thesis">
          The 517 problems here are not a list. They are <b>23 patterns in teaching order</b>, and
          inside each one the problems run easy to hard. That order is the curriculum. Working top
          to bottom is the intended way to use it.
        </p>

        <div className="docs-cols">
          <aside className="docs-rail">
            <div className="docs-rail-label">Contents</div>
            <nav aria-label="Sections of this guide">
              {SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  data-hue={s.hue}
                  aria-current={current === s.id ? 'true' : 'false'}
                  onClick={(e) => jump(e, s.id)}
                >
                  <i className="docs-rail-dot" />
                  {s.label}
                </a>
              ))}
            </nav>
          </aside>

          <main className="docs-main">
            <Section meta={byId.start}>
              <Reveal>
                <p className="docs-lede">
                  Do these five things and the rest of the app explains itself.
                </p>

                {/* Numbered because these five genuinely are a sequence. Nothing
                    else on this page is, and nothing else is numbered. */}
                <ol className="docs-steps">
                  {FIRST_HOUR.map(([title, body], i) => (
                    <li key={title} style={{ '--step-delay': `${i * 60}ms` }}>
                      <div>
                        <b>{title}</b>
                        <span>{body}</span>
                      </div>
                    </li>
                  ))}
                </ol>

                <p>Then keep going down the list. That is genuinely it.</p>
              </Reveal>
            </Section>

            <Section meta={byId.roadmap}>
              <Reveal>
                <p>
                  Each pattern is a collapsible section with its own progress bar, and inside it the
                  problems are ordered easy to hard. Resist jumping around — the ramp is the point.
                </p>

                <h3>The circle is the whole of your status</h3>
                <TryStatus />

                <p>
                  Beside it sit four more controls: <b>flag</b> for any reason you like, the{' '}
                  <b>circular arrow</b> to send something to the revision queue by hand, the{' '}
                  <b>clock</b> to log an attempt, and the <b>note</b>, which expands the row to show
                  the problem statement inline — no tab switch to read it — with a notes box under
                  it.
                </p>
                <p>
                  The circular arrow opens a small dialog: pick <i>why</i> it is coming back —{' '}
                  <b>do it later</b>, <b>learn something first</b>, <b>got it barely</b>,{' '}
                  <b>too slow</b>, <b>redo from scratch</b>, <b>keep it warm</b> — and leave one
                  line saying what you meant. Both are optional and both show on the queue row three
                  weeks later, which is the point: a bare flag is a title with nothing behind it.
                  Pressing <kbd>r</kbd> on the focused row still raises a flag with neither, because
                  at minute forty of a problem a dialog is not what you want.
                </p>
              </Reveal>

              <Reveal>
                <h3>Notes, and the rating that matters</h3>
                <p>
                  Notes autosave; there is no Save button. Under the box is a{' '}
                  <b>1–5 confidence rating</b>, and it is not decoration — it decides how soon the
                  problem comes back. Write the <i>approach</i>, not the code: &ldquo;two pointers
                  from both ends, move the smaller one&rdquo; is worth re-reading in three weeks. A
                  pasted solution is not.
                </p>

                <h3>Finding things</h3>
                <ul className="docs-list">
                  <li>
                    Press <kbd>/</kbd> to search titles, companies and topic tags at once.
                  </li>
                  <li>
                    <b>Filters</b> covers difficulty, status, sheet, topics and companies.
                  </li>
                  <li>
                    <b>Five sheets to narrow to</b>, four of them imported — Striver&rsquo;s SDE
                    Sheet, NeetCode 150, Blind 75, and everything reported asked at a named company
                    in 2025-26. The fifth, <b>AI-recommended 300</b>, is built from the other four
                    plus the company data and deduplicated by technique: it contains every Blind 75
                    problem and almost all of NeetCode 150, and it is the one to pick if you want
                    the shortest path rather than somebody else&rsquo;s list.
                  </li>
                  <li>
                    <b>Flagged</b>, <b>Needs revision</b> and <b>Added by me</b> stay out in the
                    bar, because they are the ones you flip mid-session and flip back.
                  </li>
                </ul>
                <p>
                  Everything filters instantly — the whole list is already in your browser — and the
                  filters you leave on follow your account to your next machine.
                </p>
              </Reveal>
            </Section>

            <Section meta={byId.attempts}>
              <Reveal>
                <p className="docs-lede">
                  An attempt is one sitting with one problem: how long it took, how it went, and
                  what you want to remember about it.
                </p>

                <h3>The stopwatch</h3>
                <p>
                  Press start and close the dialog. The clock keeps running — it appears as a pill
                  in the top bar on every page, and the row&rsquo;s clock icon pulses so you can see
                  which problem is being timed. Come back and the time is already filled in.
                </p>
                <TryTimer />
                <p>
                  Prefer to estimate? Presets are there — 5, 15, 30, 45, 60, 90 minutes — or type a
                  number. The moment you do, the <span className="docs-chip">timed</span> mark comes
                  off, because a measured minute and a guessed one are not the same evidence when
                  the question is whether you are getting faster.
                </p>
              </Reveal>

              <Reveal>
                <h3>Five outcomes, and what each does</h3>
                <p>
                  This is the one mechanic worth being honest with, because it decides what you see
                  again.
                </p>
                <TryOutcome />
                <p>Getting stuck on something you already solved does not un-solve it.</p>
              </Reveal>

              <Reveal>
                <h3>A note, a colour and a confidence — per sitting</h3>
                <p>
                  Each attempt carries its own note, colour and rating, alongside the ones on the
                  problem itself. They are different facts:
                </p>

                <div className="docs-duo">
                  <div className="docs-box">
                    <span className="docs-box-label">On the problem</span>
                    <p>
                      The note is what you <b>eventually understood</b>. The confidence is the
                      current reading of the problem — it sets the gap after a solve, and it is
                      overwritten every time you log, and again by however you answer a review.
                    </p>
                  </div>
                  <div className="docs-box">
                    <span className="docs-box-label">On the attempt</span>
                    <p>
                      The note is <b>what happened that day</b>. The confidence stays where you put
                      it — which is what turns the log into a story.
                    </p>
                  </div>
                </div>

                <p>
                  That second one is the payoff. <b>2 → 3 → 4</b> over three sittings is a problem
                  you are learning. <b>Three 2s</b> is a problem you are re-reading without learning
                  it.
                </p>
              </Reveal>

              <Reveal>
                <h3>The half-hour window</h3>
                <p>
                  You can <b>edit or delete an attempt for 30 minutes</b>, and then it locks. Each
                  row counts the time down and says <i>locked</i> when it is gone.
                </p>

                <div className="docs-timeline">
                  {[
                    ['Before', 'Start the clock', 'It runs in the top bar while you work.', false],
                    ['On finishing', 'Log it', 'Time, outcome, rating, a note if you want one.', false],
                    ['Next 30 min', 'Fix anything', 'Edit or delete it. The row counts down.', false],
                    ['After that', 'Locked', 'It is a record now, not a draft.', true],
                  ].map(([when, title, body, shut], i) => (
                    <div
                      className={`docs-beat ${shut ? 'shut' : ''}`}
                      key={title}
                      style={{ '--beat-delay': `${i * 90}ms` }}
                    >
                      <span className="docs-beat-when">{when}</span>
                      <b>{title}</b>
                      <span>{body}</span>
                    </div>
                  ))}
                </div>

                <p>
                  Half an hour is enough to fix the ordinary mistake — logging against the wrong
                  row, or typing 30m when you meant 3 — and short enough that the log stays
                  evidence. A history you can rewrite at leisure is a history that agrees with
                  whatever you believe today, which is the opposite of what timing yourself is for.
                </p>
                <p>
                  Deleting an attempt removes that sitting and <i>nothing else</i>. Your solved
                  status and revision schedule stay as they are.
                </p>

                <h3>Reading it back in the table</h3>
                <p>
                  The <b>Attempts</b> column shows one chip per sitting, oldest first. Read it as a
                  shape — <span className="docs-chip bad">45m</span>{' '}
                  <span className="docs-chip mid">30m</span>{' '}
                  <span className="docs-chip good">12m</span> is a very different problem from{' '}
                  <span className="docs-chip good">20m</span>{' '}
                  <span className="docs-chip bad">40m</span>{' '}
                  <span className="docs-chip bad">50m</span>, and a count of &ldquo;3
                  attempts&rdquo; cannot tell you which one you are looking at.
                </p>
              </Reveal>
            </Section>

            <Section meta={byId.revision}>
              <Reveal>
                <p>
                  Solving something schedules it to come back, on a ladder that widens each time you
                  get it right — and the confidence you gave that solve stretches or shrinks the
                  first gap.
                </p>
                <TryLadder />
                <p>
                  <b>Revision</b> in the sidebar is everything the schedule says is due, plus
                  anything you flagged by hand. It arrives in three piles — <i>late</i>,{' '}
                  <i>due today</i>, and <i>the ones you flagged</i> — because those are three
                  different claims on a morning and one list sorted by date said nothing about which
                  was which.
                </p>

                <h3>Four answers, not a tick</h3>
                <p>
                  A review has four possible endings and the queue takes all of them.{' '}
                  <b>Missed</b> drops the problem back a rung and books it for tomorrow.{' '}
                  <b>Hard</b> leaves it where it is. <b>Good</b> moves it up one. <b>Easy</b> moves
                  it up and doubles the gap. Every button is labelled with the gap it would
                  schedule and names the date in its tooltip, so you can see what you are choosing
                  before you choose it.
                </p>
                <p>
                  That replaced a single tick whose interval was multiplied by a confidence number
                  last written by some attempt months earlier — and a failure you could not express
                  at all, which left a problem you had just missed standing on a rung it had
                  plainly not earned. The <b>circular arrow</b> is still there and still means only
                  &ldquo;off the list&rdquo;: it clears the flag, and clears the schedule only if
                  that schedule is what put the row in front of you.
                </p>

                <h3>Every date, up front</h3>
                <p>
                  Each row carries its real date, not just <i>due in 5d</i>, and under it the whole
                  remaining plan: <span className="mono">review 2 of 4 · then 14 Sep · 5 Oct · 4 Dec</span>.
                  Dates past the next one assume you keep answering <b>Good</b> and move the moment
                  you do not. Below the queue, <b>Coming up</b> lists the next thirty scheduled rows
                  grouped by the day they land on — which is how you find out that Saturday has
                  eleven reviews on it before Saturday does.
                </p>
                <div className="docs-box">
                  <span className="docs-box-label">Habit</span>
                  <p>
                    Work the queue before you start new problems. That is the entire benefit of it.
                  </p>
                </div>
              </Reveal>
            </Section>

            <Section meta={byId.reading}>
              <Reveal>
                <h3>Pattern guides</h3>
                <p>
                  One per pattern, about 2,000 words, opened from the section header, with Java and
                  C++ side by side. Read the guide before the problems in that section — then
                  re-read it after you have been stuck on two of them. It reads completely
                  differently the second time, and that is when it teaches you the most.
                </p>

                <h3>Learn</h3>
                <p>
                  The roadmap teaches the algorithms. <b>Learn</b> is for everything around them —
                  the vocabulary you use every day and could not define under pressure.
                </p>

                {/*
                  Complexity on its own, above the two framework tracks, because
                  it is a different kind of thing: React and Node are notes for
                  the day job, and this is the maths the roadmap assumes. The
                  hub orders them the same way.
                */}
                <div className="docs-box" data-hue="amber">
                  <span className="docs-box-label">Complexity · 6 topics</span>
                  <p>
                    Logarithms from scratch — assuming you have not seen one since school — then
                    Big-O, counting a complexity off your own code, reading the target complexity
                    out of a problem&rsquo;s constraints, and the tables worth knowing cold.
                  </p>
                </div>

                <div className="docs-duo">
                  <div className="docs-box" data-hue="sky">
                    <span className="docs-box-label">React · 43 topics</span>
                    <p>
                      From what happens between a <code>setState</code> and the pixels, through
                      every hook, to the eight ecosystem topics a React job actually expects.
                    </p>
                  </div>
                  <div className="docs-box" data-hue="green">
                    <span className="docs-box-label">Node.js · 68 topics</span>
                    <p>
                      From closures and <code>map</code> to a hardened, paginated, authenticated API
                      with a cache, a queue and tests behind it.
                    </p>
                  </div>
                </div>

                <div className="docs-duo">
                  <div className="docs-box" data-hue="pink">
                    <span className="docs-box-label">SQL · 53 topics</span>
                    <p>
                      From &ldquo;what is a database&rdquo; through ER models and normalisation to
                      every join shown with its result, window functions, isolation levels and query
                      plans. Read alongside the <b>SQL Lab</b> below — the notes explain it, the Lab
                      makes you write it.
                    </p>
                  </div>
                  <div className="docs-box" data-hue="blue">
                    <span className="docs-box-label">Computer Networks · 35 topics</span>
                    <p>
                      OSI layers through subnets, TCP, DNS and TLS, ending at load balancers, CDNs
                      and a VPC drawn the way AWS draws it. The half of a system-design round that
                      is not algorithms.
                    </p>
                  </div>
                </div>

                <ul className="docs-list">
                  <li>
                    <b>Every Node topic ends with an Interview table</b> — the questions that topic
                    actually gets asked, answered in a line each.
                  </li>
                  <li>
                    <b>The examples are runnable</b>, and sections 7–12 build one real{' '}
                    <code>/tasks</code> API across topics rather than showing unrelated fragments.
                    You write the server by hand, rewrite it on Express, give it REST semantics and
                    pagination, put it on Postgres, add login, then attack it.
                  </li>
                </ul>
              </Reveal>
            </Section>

            {/*
              A curriculum rather than a chapter of Learn, and the section says
              so: Learn is prose you read, this is 117 problems that grade you.
              Placed directly after the SQL notes because that is the order they
              are meant to be used in.
            */}
            <Section meta={byId.sql}>
              <Reveal>
                <p>
                  <b>117 SQL problems in 8 categories</b>, on the same status circle, the same
                  25-minute editorial gate and the same revision ladder as everything else. Most
                  product-company loops put a SQL screen somewhere in them, and it is the cheapest
                  round on the list to pass if you already write SQL at work.
                </p>

                <div className="docs-duo">
                  <div className="docs-box" data-hue="pink">
                    <span className="docs-box-label">72 run in your browser</span>
                    <p>
                      SQLite compiled to WebAssembly, with their own schema and rows. Your query is
                      executed and diffed against a generated expected result — no account on
                      anybody else&rsquo;s site, no network round trip, and it works offline.
                    </p>
                  </div>
                  <div className="docs-box" data-hue="slate">
                    <span className="docs-box-label">45 link out to LeetCode</span>
                    <p>
                      Because a problem that already has a judge should be solved on it. The rule
                      between the two kinds is deliberate, not an accident of what was easy.
                    </p>
                  </div>
                </div>

                <ul className="docs-list">
                  <li>
                    <b>Joins is the block that matters.</b> 30 of the 117, and the two questions
                    every SQL round asks live in it — rows the other table does not have, and a
                    table joined to itself.
                  </li>
                  <li>
                    <b>Window functions are the ones you have probably never needed.</b> 11
                    problems, and they are what separates a passing SQL round from a strong one.
                  </li>
                  <li>
                    <b>MySQL shims and dialect notes</b>, so the answers match what the Learn track
                    teaches rather than drifting into SQLite-only syntax.
                  </li>
                </ul>
              </Reveal>
            </Section>

            {/*

              The second curriculum. It sits after the reading material and before the

              assistant because it is a *choice* rather than a step: most readers of

              this guide want the roadmap, and the ones who want a rating ladder should

              meet it as an alternative rather than as the next thing to do.

            */}

            <Section meta={byId.procoder}>

              <Reveal>

                <p>

                  Everything above is about interviews. <b>Pro Coder</b> is the other thing this app

                  does: a competitive-programming ladder of <b>800 problems</b> from Codeforces and

                  CodeChef, for getting your rating up rather than getting through a loop. It has its

                  own dark contest theme, so you always know which one you are in.

                </p>


                <h3>Tiers, not difficulties</h3>

                <p>

                  There is no Easy/Medium/Hard here. Problems carry the judge&rsquo;s own rating and

                  are grouped into seven tiers — Foundations, Pupil, Specialist, Expert, Candidate

                  Master, Master, Advanced — matching Codeforces&rsquo; own rank thresholds. The rail

                  across the top is both your progress through them and the way you jump between them.

                </p>

                <p>

                  Rating is the default spine because it is what actually gates what you can attempt.

                  One toggle (or <kbd className="mono">g</kbd>) regroups the whole ladder by{' '}

                  <b>technique</b> instead — 49 CP patterns, more granular than the roadmap&rsquo;s 22,

                  because &ldquo;dynamic programming&rdquo; is one interview pattern and eight CP ones.

                </p>

              </Reveal>


              <Reveal>

                <h3>Link your Codeforces handle</h3>

                <p>

                  The single thing most worth doing on this page. Paste your handle into the arena

                  header and press <b>Sync</b>: it reads your accepted submissions and marks

                  everything on the ladder you have already solved, and it pulls your live rating so

                  the app knows which problems are a stretch for you and which you should be getting.

                </p>

                <p>

                  Sync never takes anything away. It can mark a problem solved; it will never un-mark

                  one, clear a flag, delete a note or reset a review schedule. A problem the judge

                  says you solved but you never logged here shows an <b>AC</b> tag rather than being

                  silently ticked — with a filter on the bar for exactly that list, which is a good

                  first pass after linking.

                </p>

              </Reveal>


              <Reveal>

                <h3>Tags are hidden on purpose</h3>

                <p>

                  The judge&rsquo;s own tags are the editorial&rsquo;s answer key — seeing

                  &ldquo;dp, bitmasks&rdquo; on a problem you have not started is most of the solution.

                  So they are their own column and their own filter, both off by default. The topics

                  shown on a row are a coarser set that is safe to read while browsing.

                </p>

                <p>

                  Every pattern opens a brief — the invariant, when it fires, its complexity, what

                  goes wrong, and where to read more. Twelve of them, the ones where most people

                  stall, also carry a full write-up with Java and C++ implementations.

                </p>

                <p>

                  Flags, notes, attempts, the stopwatch, custom columns and the revision queue all

                  work exactly as they do on the roadmap. The revision queue merges both curriculums

                  and lets you work either one on its own.

                </p>

              </Reveal>

            </Section>

            {/*
              Last of the curriculum sections, because it is the only one that
              is about the others. Everything above is a thing you can do; this
              answers in what order, for how long, and starting when — which is
              the question people actually stall on once they have all four
              lists open in front of them.
            */}
            <Section meta={byId.playbook}>
              <Reveal>
                <p>
                  Four lists and a finite number of evenings is a planning problem, and the{' '}
                  <b>Playbook</b> is the answer to it: a dated, phased schedule that turns the
                  roadmap, the ladder and the SQL Lab into a week-by-week timetable — and then
                  reads your real progress back out of them, so it never has to be told what you
                  have done.
                </p>

                <div className="docs-duo">
                  <div className="docs-box" data-hue="indigo">
                    <span className="docs-box-label">24 weeks, four phases</span>
                    <p>
                      Rebuild the base (1&ndash;5), the core machine (6&ndash;13), hard mode
                      (14&ndash;18), interview mode (19&ndash;24). Weeks 13 and 18 carry no new
                      problems at all — they are what stops the middle of a plan like this from
                      quietly falling apart.
                    </p>
                  </div>
                  <div className="docs-box" data-hue="orange">
                    <span className="docs-box-label">The drift line</span>
                    <p>
                      One number that governs the week: problems solved against problems the
                      schedule expected by now, stated plainly and never softened. Ahead, on track,
                      or <i>n</i> behind — with what to cut.
                    </p>
                  </div>
                </div>

                <ul className="docs-list">
                  <li>
                    <b>Four tracks, because interview loops are not only DSA.</b> DSA in the
                    mornings, SQL on Friday evenings for twelve weeks, high-level design from week
                    13, and low-level design and machine coding from week 14 — the round that asks
                    you to build something that runs and then extend it live.
                  </li>
                  <li>
                    <b>Nothing is added on top.</b> Every hour a new track needs is taken from one
                    that was buying less, and the plan says which: SQL takes the Friday re-solve
                    hour, low-level design takes the Sunday ladder session. A plan that quietly
                    asks for more hours than you have is one you fail in week three.
                  </li>
                  <li>
                    <b>The Method tab is the part to re-read on a bad week.</b> Six panels: where
                    the hours go, the six-step loop for a single problem with a clock on every step,
                    the five stages of getting comfortable with a whole pattern, what a pattern
                    costs once you are confident, the four revision intervals and their real weekly
                    price, and the four mental models that make solved problems <i>available</i>{' '}
                    ones.
                  </li>
                  <li>
                    <b>Tick boxes and a Sunday retro line, and nothing else stored.</b> The plan
                    itself is a document, identical for everyone; what is yours is the start date,
                    what you have ticked and one honest sentence a week.
                  </li>
                </ul>
              </Reveal>
            </Section>

            <Section meta={byId.assistant}>
              <Reveal>
                <h3>The assistant</h3>
                <p>
                  <b>AI Chat</b> in the sidebar, or the bubble in the corner of any page. Pick a
                  model or let it route each question to a suitable one. Threads are kept. The{' '}
                  <b>Ask AI</b> button on a problem&rsquo;s statement opens it with that problem
                  already attached — for when the notes did not answer the question and you do not
                  want to lose your place.
                </p>

                <h3>Tasks</h3>
                <p>
                  The roadmap records what happened. <b>Tasks</b> records what you <i>meant</i> to
                  happen. &ldquo;I&rsquo;ll do these three sliding-window questions today&rdquo; is
                  about three problems at once, has a deadline, and is true before you have opened
                  any of them — so it does not fit on a problem row.
                </p>

                <ul className="docs-list">
                  <li>
                    <b>Subtasks</b>, with their own checkboxes.
                  </li>
                  <li>
                    <b>A deadline</b> — which defaults to unlimited, because most things do not have
                    one.
                  </li>
                  <li>
                    <b>Files</b> — screenshots and PDFs, and you can paste a screenshot straight in.
                  </li>
                  <li>
                    <b>Problems from the roadmap</b>, which tick themselves off as you solve them.
                  </li>
                  <li>
                    <b>A stopwatch</b> — one running at a time across the board, so you learn how
                    long things actually take.
                  </li>
                </ul>
              </Reveal>
            </Section>

            <Section meta={byId.stats}>
              <Reveal>
                <p>Four panels, and one of them is the one to act on:</p>

                <div className="docs-tablewrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Panel</th>
                        <th>What it tells you</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <b>Solved ring</b>
                        </td>
                        <td className="docs-gloss">Where you are, split by difficulty.</td>
                      </tr>
                      <tr>
                        <td>
                          <b>Activity heatmap</b>
                        </td>
                        <td className="docs-gloss">
                          A year of days, with your current and longest streak. Selectable over 3, 6
                          or 12 months, or a calendar year.
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <b>Weakest patterns</b>
                        </td>
                        <td className="docs-gloss">The panel to actually act on. Check it weekly.</td>
                      </tr>
                      <tr>
                        <td>
                          <b>Company coverage</b>
                        </td>
                        <td className="docs-gloss">
                          What you have solved <i>and</i> how many that company asks — 12 solved
                          means nothing on its own.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p>
                  <b>Profile</b> holds your picture, your numbers, and an About panel for bio,
                  college, graduation year, target role and links. Anything you sent through{' '}
                  <b>Feedback</b> sits at the foot of that page with its status, so a reply does
                  not go unread inside a dialog you have no reason to open twice.
                </p>
              </Reveal>
            </Section>

            <Section meta={byId.yours}>
              <Reveal>
                <h3>The table</h3>
                <p>
                  Twenty-four columns exist; you choose which you see. <b>Columns</b> in the toolbar
                  opens the editor — show and hide, reorder, five width presets, and pinning. You
                  can freeze up to three columns to the left edge so they stay put as you scroll
                  sideways. The layout is saved per browser, so your laptop and your monitor can be
                  set up differently.
                </p>

                <h3>Adding your own problems</h3>
                <p>
                  <b>Add</b> in the top bar takes a single URL. Paste a LeetCode link and the title,
                  difficulty and tags fill themselves in; paste anything else and you fill three
                  short fields. Your problems sit in the same pattern sections as the rest, carry a{' '}
                  <span className="docs-chip">MINE</span> tag, and <b>only you can see them</b>.
                </p>
                <p>
                  You can edit or delete your own problems. The URL is fixed after adding, because
                  it is what your history is joined on — delete and re-add if the link was wrong.
                </p>

                <h3>Theme</h3>
                <p>
                  Light or dark, and thirteen accent colours, from the top bar. This page follows
                  whatever you pick, including the colours you are reading it in now.
                </p>
              </Reveal>
            </Section>

            <Section meta={byId.keys}>
              <Reveal>
                <TryKeys />
                <p>
                  On the task board, with a card focused: <kbd>Enter</kbd> opens it, and{' '}
                  <kbd>[</kbd> <kbd>]</kbd> move it a column left or right. <kbd>Ctrl</kbd>{' '}
                  <kbd>B</kbd> collapses the sidebar anywhere.
                </p>
              </Reveal>
            </Section>

            <Section meta={byId.wrong}>
              <Reveal>
                <div className="docs-tablewrap">
                  <table>
                    <thead>
                      <tr>
                        <th>What you see</th>
                        <th>What it means</th>
                      </tr>
                    </thead>
                    <tbody>
                      {TROUBLE.map(([what, why]) => (
                        <tr key={what}>
                          <td>
                            <b>{what}</b>
                          </td>
                          <td className="docs-gloss">{why}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Reveal>
            </Section>

            <Reveal>
              <div className="docs-closer">
                <h2>The short version</h2>
                <p>
                  Read the pattern guide. Work top to bottom. Time yourself. Be honest about whether
                  you needed the video. Work the revision queue before starting anything new. Check
                  your weakest patterns once a week.
                </p>
                <p>The app does the bookkeeping so you can spend your attention on the problems.</p>

                {user ? (
                  <Link to="/" className="btn primary docs-cta">
                    <IconArrowLeft size={13} />
                    Back to the course
                  </Link>
                ) : (
                  <Link to="/register" className="btn primary docs-cta">
                    Start your journey
                    <IconChevronRight size={13} />
                  </Link>
                )}
              </div>
            </Reveal>

            <p className="docs-colophon">
              {BRAND.name} — {BRAND.tagline}. 517 problems across 23 patterns, 117 SQL problems, a
              1,100-problem CP ladder, and 205 reference topics across Complexity, React, Node,
              SQL and Computer Networks.
            </p>
          </main>
        </div>
      </div>
    </div>
  );
}
