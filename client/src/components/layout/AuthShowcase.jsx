import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IconBook,
  IconCalendar,
  IconCheck,
  IconCode,
  IconDatabase,
  IconLayers,
  IconShapes,
  IconSparkle,
} from '../ui/Icons.jsx';

/**
 * The right half of the auth pages: what this app actually is, one module at a
 * time.
 *
 * It used to be a single panel about the roadmap, which was honest but sold one
 * seventh of the product — someone deciding whether to sign up never learned
 * that there is a SQL lab, a CP ladder, a plan, an assistant or a design board
 * in here. So it is a slideshow now: seven slides, each a module, each drawn as
 * a small picture of that module's own screen rather than a stock illustration.
 * Nothing here is a photograph of a thing that does not exist.
 *
 * The rules it keeps:
 *  - **Every mock is built from the app's own vocabulary** — pattern rows, a
 *    rating chip, a result grid, a DBML table — so signing in never shows you
 *    something the app does not contain.
 *  - **It is inert.** No data, no requests. The numbers are the same ones the
 *    public guide at /docs prints, written out rather than fetched.
 *  - **A module still being built says so** (`tag`), because the panel's whole
 *    value is that you can trust it.
 *  - **It moves only if the visitor lets it.** Auto-advance stops on hover or
 *    focus and never starts under `prefers-reduced-motion`; the dots are real
 *    buttons, so the slideshow is never the only way to reach a slide.
 */

const DWELL = 7000;

/* -------------------------------------------------------------------------- */
/* the mocks — one small screen per module                                     */
/* -------------------------------------------------------------------------- */

function Window({ caption, children }) {
  return (
    <div className="auth-mock">
      <div className="auth-mock-bar">
        <span />
        <span />
        <span />
        {caption && <b className="auth-mock-title mono">{caption}</b>}
      </div>
      <div className="auth-mock-body">{children}</div>
    </div>
  );
}

// Numbers a real account sees on day one of week three. Specific enough to read
// as a product and not a wireframe.
const PATTERNS = [
  { step: '01', name: 'Arrays & Hashing', solved: 24, total: 32 },
  { step: '02', name: 'Two Pointers', solved: 11, total: 16 },
  { step: '03', name: 'Prefix Sum', solved: 6, total: 14 },
  { step: '04', name: 'Sliding Window', solved: 2, total: 18 },
];

function RoadmapMock() {
  return (
    <Window caption="roadmap">
      {PATTERNS.map((row) => (
        <div className="auth-mock-row" key={row.step}>
          <span className="auth-mock-step mono">{row.step}</span>
          <span className="auth-mock-name">{row.name}</span>
          <span className="auth-mock-bar-track">
            <span style={{ width: `${Math.round((row.solved / row.total) * 100)}%` }} />
          </span>
          <span className="auth-mock-frac mono">
            {row.solved}/{row.total}
          </span>
        </div>
      ))}
    </Window>
  );
}

// The six tracks and their sizes, as the guide at /docs prints them.
const TRACKS = [
  { name: 'Complexity', topics: 6, hue: 'amber' },
  { name: 'React', topics: 43, hue: 'sky' },
  { name: 'Node.js', topics: 68, hue: 'green' },
  { name: 'SQL', topics: 53, hue: 'pink' },
  { name: 'Computer Networks', topics: 35, hue: 'blue' },
  { name: 'System Design', topics: 104, hue: 'indigo' },
];

function LearnMock() {
  return (
    <Window caption="learn">
      <div className="auth-tracks">
        <div className="auth-track head">
          <span className="auth-track-name">Track</span>
          <span className="auth-track-count">Topics</span>
        </div>
        {TRACKS.map((track) => (
          <div className="auth-track" key={track.name} data-hue={track.hue}>
            <span className="auth-track-dot" />
            <span className="auth-track-name">{track.name}</span>
            <span className="auth-track-count mono">{track.topics}</span>
          </div>
        ))}
      </div>
    </Window>
  );
}

const QUERY = [
  [['k', 'select'], ['p', ' c.name, '], ['f', 'count'], ['p', '(*) '], ['k', 'as'], ['p', ' orders']],
  [['k', 'from'], ['p', ' customers c']],
  [['k', 'join'], ['p', ' orders o '], ['k', 'on'], ['p', ' o.customer_id = c.id']],
  [['k', 'group by'], ['p', ' c.name '], ['k', 'order by'], ['p', ' orders '], ['k', 'desc']],
];

function SqlMock() {
  return (
    <Window caption="sql lab · joins">
      <pre className="auth-code mono">
        {QUERY.map((line, i) => (
          <div key={i}>
            {line.map(([kind, text], j) => (
              <span key={j} className={`auth-code-${kind}`}>
                {text}
              </span>
            ))}
          </div>
        ))}
      </pre>
      <div className="auth-grid">
        <div className="auth-grid-row head">
          <span>name</span>
          <span className="num">orders</span>
        </div>
        {[
          ['Priya', 14],
          ['Marco', 9],
          ['Aisha', 6],
        ].map(([name, orders]) => (
          <div className="auth-grid-row" key={name}>
            <span>{name}</span>
            <span className="num mono">{orders}</span>
          </div>
        ))}
      </div>
      <p className="auth-mock-foot">
        <IconCheck size={11} />
        Ran in your browser · 3 rows match the expected result
      </p>
    </Window>
  );
}

// `band` is the judge's own rank colour for that rating, not a gradient of our
// own: the tiers below are Codeforces' names, so the colours have to be theirs.
const LADDER = [
  { rating: 800, name: 'Distinct Numbers', band: 'newbie', done: true },
  { rating: 1200, name: 'Subarray Sums II', band: 'pupil', done: true },
  { rating: 1500, name: 'Nested Ranges Check', band: 'specialist', done: false },
  { rating: 1900, name: 'Flight Discount', band: 'cm', done: false },
];

function CpMock() {
  return (
    <Window caption="pro coder · ladder">
      <div className="auth-tiers">
        {['Foundations', 'Pupil', 'Specialist', 'Expert', 'CM', 'Master'].map((tier, i) => (
          <span key={tier} className={`auth-tier ${i < 2 ? 'on' : ''}`}>
            {tier}
          </span>
        ))}
      </div>
      {LADDER.map((row) => (
        <div className="auth-mock-row" key={row.name}>
          <span className={`auth-rating mono ${row.band}`}>{row.rating}</span>
          <span className="auth-mock-name">{row.name}</span>
          <span className={`auth-dot ${row.done ? 'on' : ''}`}>{row.done ? <IconCheck size={10} /> : null}</span>
        </div>
      ))}
    </Window>
  );
}

const PHASES = [
  { name: 'Rebuild the base', weeks: 'Weeks 1–5', pct: 100 },
  { name: 'The core machine', weeks: 'Weeks 6–13', pct: 62 },
  { name: 'Hard mode', weeks: 'Weeks 14–18', pct: 0 },
  { name: 'Interview mode', weeks: 'Weeks 19–24', pct: 0 },
];

function PlaybookMock() {
  return (
    <Window caption="playbook · week 9">
      {PHASES.map((phase) => (
        <div className="auth-phase" key={phase.name}>
          <span className="auth-phase-name">{phase.name}</span>
          <span className="auth-phase-weeks mono">{phase.weeks}</span>
          <span className="auth-mock-bar-track">
            <span style={{ width: `${phase.pct}%` }} />
          </span>
        </div>
      ))}
      <p className="auth-mock-foot drift">
        <b>On track</b> · 214 solved against the 209 this week expected
      </p>
    </Window>
  );
}

/*
  The board slide carries two pictures because the module is two things: a
  canvas you draw a system on, and a schema board where DBML text and the
  diagram are the same document. Showing only the canvas would sell half of it.
*/
function DesignMock() {
  return (
    <Window caption="whatsapp · hld">
      {/* The board is a fixed 340×96 box so these pixel positions and the SVG's
          own units are the same grid — a wire has to end exactly on a node. */}
      <div className="auth-board">
        <svg className="auth-board-wires" viewBox="0 0 340 96" aria-hidden="true">
          <path d="M84 30h42" />
          <path d="M210 30h46" />
          <path d="M168 44v34h88" />
          <circle className="auth-board-flow" r="2.6">
            <animateMotion dur="2.4s" repeatCount="indefinite" path="M84 30h42" />
          </circle>
          <circle className="auth-board-flow" r="2.6">
            <animateMotion dur="3.4s" repeatCount="indefinite" path="M168 44v34h88" />
          </circle>
        </svg>
        <span className="auth-node" style={{ left: 0, top: 16 }} data-hue="sky">
          Clients
        </span>
        <span className="auth-node" style={{ left: 126, top: 16 }} data-hue="violet">
          API gateway
        </span>
        <span className="auth-node" style={{ left: 256, top: 16 }} data-hue="green">
          Chat service
        </span>
        <span className="auth-node" style={{ left: 256, top: 64 }} data-hue="pink">
          Kafka
        </span>
      </div>
      <div className="auth-table" data-hue="violet">
        <span className="auth-table-head">messages</span>
        {[
          ['id', 'bigint', 'pk'],
          ['chat_id', 'bigint', 'fk'],
          ['body', 'text', ''],
          ['sent_at', 'timestamptz', ''],
        ].map(([col, type, key]) => (
          <span className="auth-table-row" key={col}>
            <b className={key ? `auth-key ${key}` : 'auth-key'}>{key === 'pk' ? '⚿' : key === 'fk' ? '↗' : ''}</b>
            <span className="auth-table-col">{col}</span>
            <span className="auth-table-type mono">{type}</span>
          </span>
        ))}
      </div>
    </Window>
  );
}

function AssistantMock() {
  return (
    <Window caption="ask ai · tasks">
      <div className="auth-chat">
        <span className="auth-bubble you">Why is this two pointers and not a hash map?</span>
        <span className="auth-bubble ai">
          <b>Because the array is sorted.</b> A hash map gets you O(n) time but O(n) space; sorted
          input lets you…
        </span>
        <span className="auth-attach mono">📎 3. Longest Substring Without Repeating Characters</span>
      </div>
      <div className="auth-task">
        <span className="auth-task-title">Three sliding-window questions tonight</span>
        <span className="auth-subtask done">
          <IconCheck size={9} /> Longest Repeating Character Replacement
        </span>
        <span className="auth-subtask done">
          <IconCheck size={9} /> Permutation in String
        </span>
        <span className="auth-subtask">Minimum Window Substring</span>
        <span className="auth-task-foot mono">⏱ 24:10 running · due today</span>
      </div>
    </Window>
  );
}

/* -------------------------------------------------------------------------- */
/* the slides                                                                  */
/* -------------------------------------------------------------------------- */

/*
  What the product does, in the order someone deciding whether to sign up cares
  about it: the two curriculums first, then the material, then the plan that
  sequences them, then the help, then the board.

  Each line names something you can actually go and use. A slide for something
  still being built carries a `tag` that says so — the panel is only worth
  reading because nothing on it is aspirational.
*/
const SLIDES = [
  {
    id: 'roadmap',
    label: 'Roadmap',
    hue: 'blue',
    Icon: IconLayers,
    kicker: 'The roadmap',
    title: ['Every pattern, in the order', 'that builds on itself.'],
    Mock: RoadmapMock,
    points: [
      '23 patterns, 517 problems, ordered so each one builds on the last',
      'Revision that schedules itself — the ones you nearly missed come back',
      'Company tags, difficulty and sheet filters on every problem',
    ],
  },
  {
    id: 'learn',
    label: 'Learn',
    hue: 'teal',
    Icon: IconBook,
    kicker: 'Guides & Learn',
    title: ['The vocabulary you use daily', 'and could not define under pressure.'],
    Mock: LearnMock,
    points: [
      'Five tracks: complexity, React, Node.js, SQL and computer networks',
      'A written guide behind every pattern, with Java and C++ side by side',
      'Runnable examples — sections 7–12 of Node build one real /tasks API',
    ],
  },
  {
    id: 'sql',
    label: 'SQL Lab',
    hue: 'pink',
    Icon: IconDatabase,
    kicker: 'SQL Lab',
    title: ['Write the query.', 'It runs right here.'],
    Mock: SqlMock,
    points: [
      '117 problems in 8 categories, on the same status circle as everything else',
      '72 run in your browser on SQLite compiled to WebAssembly — offline, no account',
      'Joins is 30 of them: the two questions every SQL round asks live there',
    ],
  },
  {
    id: 'procoder',
    label: 'Pro Coder',
    hue: 'lime',
    Icon: IconCode,
    kicker: 'Pro Coder',
    title: ['A rating ladder,', 'not a difficulty label.'],
    Mock: CpMock,
    points: [
      '800 Codeforces and CodeChef problems across seven tiers',
      'Link your handle and it marks everything the judge says you have solved',
      '49 CP patterns, each with a brief — the invariant, when it fires, what breaks',
    ],
  },
  {
    id: 'playbook',
    label: 'Playbook',
    hue: 'indigo',
    Icon: IconCalendar,
    kicker: 'The Playbook',
    title: ['Four lists, a finite number', 'of evenings, one schedule.'],
    Mock: PlaybookMock,
    points: [
      '24 weeks in four phases, reading your real progress back out of the app',
      'Four tracks, because a loop is not only DSA — SQL, HLD and machine coding too',
      'Nothing is added on top: every new hour is taken from one buying less',
    ],
  },
  {
    id: 'assistant',
    label: 'Assistant',
    hue: 'fuchsia',
    Icon: IconSparkle,
    kicker: 'Assistant & Tasks',
    title: ['Ask about the problem', 'you are actually on.'],
    Mock: AssistantMock,
    points: [
      'Your pick of model, or let it route each question — every thread kept',
      'Ask AI from a problem statement opens with that problem attached',
      'Tasks with subtasks, files, linked problems and one stopwatch across the board',
    ],
  },
  {
    id: 'design',
    label: 'System Design',
    hue: 'violet',
    Icon: IconShapes,
    kicker: 'System Design',
    tag: 'In development',
    title: ['A board for the half of the loop', 'that is not algorithms.'],
    Mock: DesignMock,
    points: [
      'Projects hold HLD, LLD and Database boards — draw, connect, animate the traffic',
      'Schema boards keep DBML text and the diagram in sync, either side editable',
      '173 components with their real logos, from Redis to a load balancer',
    ],
  },
];

/* -------------------------------------------------------------------------- */

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function AuthShowcase() {
  const [index, setIndex] = useState(0);
  // Auto-advance is a courtesy, not the point: it stops the moment someone is
  // reading (hover) or using the dots (focus), and never runs under reduced motion.
  const [held, setHeld] = useState(reducedMotion);
  // Bumped every time the dwell timer (re)starts, and used as the progress
  // hairline's key, so the bar and the timer it draws can never disagree.
  const [run, setRun] = useState(0);
  const timer = useRef(null);
  const navRef = useRef(null);

  const go = useCallback((next) => setIndex((n) => (next + SLIDES.length) % SLIDES.length), []);

  useEffect(() => {
    if (held) return undefined;
    setRun((n) => n + 1);
    timer.current = setTimeout(() => go(index + 1), DWELL);
    return () => clearTimeout(timer.current);
  }, [index, held, go]);

  // Arrows move the slideshow, and focus goes with it — otherwise the button you
  // are standing on and the slide you are looking at drift apart.
  const onKeyDown = (event) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + SLIDES.length) % SLIDES.length;
    setIndex(next);
    navRef.current?.querySelectorAll('.auth-nav-btn')[next]?.focus();
  };

  return (
    <aside
      className="auth-show"
      aria-label="What this app does"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(reducedMotion())}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(reducedMotion())}
    >
      <div className="auth-glow" data-hue={SLIDES[index].hue} />

      <div className="auth-show-inner">
        <div className="auth-slides">
          {SLIDES.map((slide, i) => {
            const on = i === index;
            // An inactive slide is `visibility: hidden`, so nothing in it is reachable
            // by tab or read out of turn; `aria-hidden` says the same thing plainly.
            return (
              <section key={slide.id} className={`auth-slide ${on ? 'on' : ''}`} data-hue={slide.hue} aria-hidden={!on}>
                <p className="auth-kicker">
                  <slide.Icon size={13} />
                  {slide.kicker}
                  {slide.tag && <span className="auth-tag">{slide.tag}</span>}
                </p>
                <h2>
                  {slide.title[0]}
                  <br />
                  {slide.title[1]}
                </h2>

                <div className="auth-mock-wrap" aria-hidden="true">
                  <slide.Mock />
                </div>

                <ul className="auth-points">
                  {slide.points.map((point) => (
                    <li key={point}>
                      <IconCheck size={11} />
                      {point}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <div className="auth-nav" role="group" aria-label="Modules" ref={navRef} onKeyDown={onKeyDown}>
          {SLIDES.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              className={`auth-nav-btn ${i === index ? 'on' : ''}`}
              data-hue={slide.hue}
              aria-label={slide.label}
              aria-current={i === index}
              title={slide.label}
              onClick={() => setIndex(i)}
            >
              <slide.Icon size={14} />
              <span className="auth-nav-label">{slide.label}</span>
              {i === index && (
                <span key={run} className={`auth-nav-fill ${held ? 'held' : ''}`} style={{ animationDuration: `${DWELL}ms` }} />
              )}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
