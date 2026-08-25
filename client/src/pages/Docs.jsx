import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BRAND } from '../brand.js';
import { useAuth } from '../store/AuthContext.jsx';
import { IconArrowLeft, IconBook, IconChevronRight } from '../components/ui/Icons.jsx';

/**
 * What this app is and how to use it — the page for people using Ember rather
 * than building it.
 *
 * Public. It is mounted on both sides of the auth branch in App.jsx, because
 * the one reader who most needs it is the one who has not signed up yet, and a
 * page that answers "what is this" from behind a login answers nobody. Signed
 * in it renders inside the shell and picks up the sidebar; signed out it draws
 * its own thin bar, which is the only difference between the two.
 *
 * It reads from `AuthContext` for exactly one thing: which way the button at
 * the foot points. Nothing here fetches.
 */

const SECTIONS = [
  { id: 'start', label: 'Your first hour' },
  { id: 'roadmap', label: 'The roadmap' },
  { id: 'attempts', label: 'Logging an attempt' },
  { id: 'revision', label: 'Revision' },
  { id: 'reading', label: 'Guides & Learn' },
  { id: 'assistant', label: 'Assistant & Tasks' },
  { id: 'stats', label: 'Stats' },
  { id: 'yours', label: 'Making it yours' },
  { id: 'keys', label: 'Shortcuts' },
  { id: 'wrong', label: 'If it looks wrong' },
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
    'Click the clock icon on the row. Say how long it took and how it went. This is the habit everything else depends on.',
  ],
  [
    'Mark it solved',
    'The circle in the first column cycles not started → attempted → solved. Logging an attempt usually does this for you.',
  ],
];

const ROW_CONTROLS = [
  ['The circle', 'Your status. Click to cycle: not started → attempted → solved.'],
  ['Flag', 'Mark it for any reason you like — "come back to this", "this one was interesting".'],
  ['Circular arrow', 'Needs revision. Puts it in the Revision queue by hand.'],
  ['Clock', 'Log an attempt. The big one — see below.'],
  ['Note', 'Expands the row to show the problem statement and your notes.'],
  ['Pencil', 'Edit. Only appears on problems you added yourself.'],
];

/*
  Mirrors OUTCOMES in components/problem/attempts.js, which mirrors the server's
  own table. Written out rather than imported: this page explains the rule to
  someone reading it, and the wording that belongs in a chip 24px tall is not
  the wording that belongs in a paragraph about what the chip means.
*/
const OUTCOME_ROWS = [
  ['Solved', 'Got it on your own', 'good', true, false],
  ['With hints', 'Needed a nudge — a hint, a tag, the discussion', 'mid', true, false],
  ['After video', 'Watched the walkthrough, then wrote it', 'mid', true, true],
  ['Partial', 'Brute force only, or it did not pass', 'bad', false, true],
  ['Stuck', 'No real progress', 'bad', false, true],
];

const LIFECYCLE = [
  ['Before', 'Start the clock', 'It runs in the top bar while you work.', false],
  ['On finishing', 'Log it', 'Time, outcome, rating, a note if you want one.', false],
  ['Next 30 min', 'Fix anything', 'Edit or delete it. The row counts down.', false],
  ['After that', 'Locked', 'It is a record now, not a draft.', true],
];

const ROADMAP_KEYS = [
  [['j', 'k'], 'move between problems'],
  [['s'], 'toggle solved'],
  [['f'], 'flag'],
  [['r'], 'needs revision'],
  [['n'], 'notes'],
  [['o'], 'open in a new tab'],
  [['/'], 'search'],
  [['Esc'], 'leave search, or close anything open'],
  [['Ctrl', 'B'], 'collapse the sidebar'],
];

const BOARD_KEYS = [
  [['Enter'], 'open the card'],
  [['[', ']'], 'move it a column left or right'],
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

/**
 * Marks the section nearest the top of the viewport in the contents rail.
 *
 * The margins pull the trigger line down from the very top, so a heading reads
 * as current once you are actually reading under it rather than the instant its
 * first pixel appears.
 */
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

const Eyebrow = ({ children }) => <span className="docs-eyebrow">{children}</span>;

const Keys = ({ rows }) => (
  <div className="docs-keys">
    {rows.map(([keys, what]) => (
      <div className="docs-key" key={keys.join('+')}>
        <span className="docs-key-caps">
          {keys.map((k) => (
            <kbd key={k}>{k}</kbd>
          ))}
        </span>
        {what}
      </div>
    ))}
  </div>
);

export function Docs() {
  const { user } = useAuth();
  const ids = useMemo(() => SECTIONS.map((s) => s.id), []);
  const current = useCurrentSection(ids);

  return (
    <div className={`docs ${user ? '' : 'docs-public'}`}>
      {/* Signed out there is no shell around this, so the page has to carry its
          own way in and its own way back to the sign-in form. */}
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
        <header className="docs-masthead">
          <div className="docs-kind">
            <IconBook size={13} />
            Field guide
          </div>

          <h1>Learn the pattern. Then the problems are practice.</h1>

          <p className="docs-standfirst">
            Everything {BRAND.name} does, in the order you will actually need it.
            No setup, no code — this is the guide for using the thing.
          </p>

          <p className="docs-thesis">
            The 429 problems here are not a list. They are <b>22 patterns in
            teaching order</b>, and inside each one the problems run easy to
            hard. That order is the curriculum. Working top to bottom is the
            intended way to use it.
          </p>
        </header>

        <div className="docs-cols">
          <aside className="docs-rail">
            <div className="docs-rail-label">Contents</div>
            <nav aria-label="Sections of this guide">
              {SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  aria-current={current === s.id ? 'true' : 'false'}
                >
                  {s.label}
                </a>
              ))}
            </nav>
          </aside>

          <main className="docs-main">
            <section id="start">
              <Eyebrow>Start here</Eyebrow>
              <h2>Your first hour</h2>
              <p className="docs-lede">
                Do these five things and the rest of the app explains itself.
              </p>

              {/* Numbered because these five genuinely are a sequence. Nothing
                  else on this page is, and nothing else gets numbers. */}
              <ol className="docs-steps">
                {FIRST_HOUR.map(([title, body]) => (
                  <li key={title}>
                    <div>
                      <b>{title}</b>
                      <span>{body}</span>
                    </div>
                  </li>
                ))}
              </ol>

              <p>Then keep going down the list. That is genuinely it.</p>
            </section>

            <section id="roadmap">
              <Eyebrow>The main screen</Eyebrow>
              <h2>The roadmap</h2>

              <p>
                Each pattern is a collapsible section with its own progress bar,
                and inside it the problems are ordered easy to hard. Resist
                jumping around — the ramp is the point.
              </p>

              <h3>What each row can do</h3>

              <div className="docs-tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Control</th>
                      <th>What it does</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ROW_CONTROLS.map(([name, what]) => (
                      <tr key={name}>
                        <td>
                          <b>{name}</b>
                        </td>
                        <td className="docs-gloss">{what}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3>Notes, and the rating that matters</h3>

              <p>
                The note icon expands the row and gives you the{' '}
                <b>problem statement inline</b> — no tab switch to read it —
                with a notes box underneath. Notes autosave; there is no Save
                button.
              </p>

              <p>
                Under the box is a <b>1–5 confidence rating</b>, and it is not
                decoration. It decides how soon the problem comes back for
                revision. Write the <i>approach</i>, not the code: &ldquo;two
                pointers from both ends, move the smaller one&rdquo; is worth
                re-reading in three weeks. A pasted solution is not.
              </p>

              <h3>Finding things</h3>

              <ul className="docs-list">
                <li>
                  Press <kbd>/</kbd> to search titles, companies and topic tags
                  at once.
                </li>
                <li>
                  <b>Filters</b> covers difficulty, status, sheet, topics and
                  companies.
                </li>
                <li>
                  <b>Flagged</b>, <b>Needs revision</b> and <b>Added by me</b>{' '}
                  sit out in the bar, because they are the ones you flip
                  mid-session and flip back.
                </li>
              </ul>

              <p>
                Everything filters instantly — the whole list is already in your
                browser — and the filters you leave on follow your account to
                your next machine.
              </p>
            </section>

            <section id="attempts">
              <Eyebrow>The feature worth the most</Eyebrow>
              <h2>Logging an attempt</h2>

              <p className="docs-lede">
                An attempt is one sitting with one problem: how long it took,
                how it went, and what you want to remember about it. Click the
                clock on any row.
              </p>

              <h3>The stopwatch</h3>

              <p>
                Press <b>Start</b> and close the dialog. The clock keeps running
                — it appears as a pill in the top bar on every page, and the
                row&rsquo;s clock icon pulses so you can see which problem is
                being timed.
              </p>

              <p>
                Go and solve the problem. When you open the log again the time
                is already filled in and marked{' '}
                <span className="docs-chip">timed</span>. You can also click the
                pill in the top bar to log it from wherever you are.
              </p>

              <p>
                Prefer to estimate? The presets are there — 5, 15, 30, 45, 60,
                90 minutes — or type a number. The moment you do, the{' '}
                <span className="docs-chip">timed</span> mark comes off, because
                a measured minute and a guessed one are not the same evidence
                when the question is whether you are getting faster.
              </p>

              <h3>How it went</h3>

              <p>
                Five outcomes, and each one does something different to the row.
              </p>

              <div className="docs-tablewrap">
                <table className="docs-outcomes">
                  <thead>
                    <tr>
                      <th>Outcome</th>
                      <th>Means</th>
                      <th className="docs-center">Solved</th>
                      <th className="docs-center">Revisit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {OUTCOME_ROWS.map(([name, means, tone, solves, revisit]) => (
                      <tr key={name} className={`tone-${tone}`}>
                        <td>
                          <b>{name}</b>
                        </td>
                        <td className="docs-gloss">{means}</td>
                        <td className="docs-center">
                          <span className={solves ? 'docs-yes' : 'docs-no'}>
                            {solves ? '✓' : '–'}
                          </span>
                        </td>
                        <td className="docs-center">
                          <span className={revisit ? 'docs-yes' : 'docs-no'}>
                            {revisit ? '✓' : '–'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="docs-box">
                <span className="docs-box-label">The one to understand</span>
                <p>
                  <b>After video</b> solves the problem <i>and</i> schedules it
                  to come back, because a problem you needed the solution for is
                  not a problem you know. Be honest with this control — it is
                  the one that decides what you see again.
                </p>
              </div>

              <p>
                Getting stuck on something you already solved does not un-solve
                it.
              </p>

              <h3>A note, a colour and a confidence — per sitting</h3>

              <p>
                Each attempt carries its own note, colour and rating, alongside
                the ones on the problem itself. They are different facts:
              </p>

              <div className="docs-duo">
                <div className="docs-box">
                  <span className="docs-box-label">On the problem</span>
                  <p>
                    The note is what you <b>eventually understood</b>. The
                    confidence is the current number the revision schedule uses,
                    and it is overwritten every time you log.
                  </p>
                </div>
                <div className="docs-box">
                  <span className="docs-box-label">On the attempt</span>
                  <p>
                    The note is <b>what happened that day</b>. The confidence
                    stays where you put it — which is what turns the log into a
                    story.
                  </p>
                </div>
              </div>

              <p>
                That second one is the payoff. <b>2 → 3 → 4</b> over three
                sittings is a problem you are learning. <b>Three 2s</b> is a
                problem you are re-reading without learning it. The colour is
                simply a mark to find a sitting again later.
              </p>

              <h3>The half-hour window</h3>

              <p>
                The right side of the dialog is every attempt on that problem,
                newest first, with its notes. You can{' '}
                <b>edit or delete an attempt for 30 minutes</b>, and then it
                locks. Each row counts the time down and says <i>locked</i> when
                it is gone.
              </p>

              <div className="docs-timeline">
                {LIFECYCLE.map(([when, title, body, shut]) => (
                  <div className={`docs-beat ${shut ? 'shut' : ''}`} key={title}>
                    <span className="docs-beat-when">{when}</span>
                    <b>{title}</b>
                    <span>{body}</span>
                  </div>
                ))}
              </div>

              <p>
                Half an hour is enough to fix the ordinary mistake — logging
                against the wrong row, or typing 30m when you meant 3 — and
                short enough that the log stays evidence. A history you can
                rewrite at leisure is a history that agrees with whatever you
                believe today, which is the opposite of what timing yourself is
                for.
              </p>

              <p>
                Deleting an attempt removes that sitting and <i>nothing else</i>.
                Your solved status and revision schedule stay as they are. If
                the status is wrong, the circle in the first column is one click.
              </p>

              <h3>Reading it back in the table</h3>

              <p>
                The <b>Attempts</b> column shows one chip per sitting, oldest
                first — the outcome on the border, your colour down the left
                edge, a dot when there is a note.
              </p>

              <p>
                Read it as a shape.{' '}
                <span className="docs-chip bad">45m</span>{' '}
                <span className="docs-chip mid">30m</span>{' '}
                <span className="docs-chip good">12m</span> is a very different
                problem from <span className="docs-chip good">20m</span>{' '}
                <span className="docs-chip bad">40m</span>{' '}
                <span className="docs-chip bad">50m</span>, and a count of
                &ldquo;3 attempts&rdquo; cannot tell you which one you are
                looking at. Hover for the full history.
              </p>
            </section>

            <section id="revision">
              <Eyebrow>Not forgetting</Eyebrow>
              <h2>Revision</h2>

              <p>
                Solving something schedules it to come back. The ladder widens
                each time you get it right:
              </p>

              {/* Drawn to scale, so the widening gap is the thing you see
                  rather than four numbers you have to compare. */}
              <div className="docs-ladder">
                {[
                  [3, 3],
                  [7, 7],
                  [21, 14],
                  [60, 22],
                ].map(([days, grow], i) => (
                  <div
                    className={`docs-rung ${i === 3 ? 'last' : ''}`}
                    key={days}
                    style={{ flex: grow }}
                  >
                    <b>{days}</b>
                    <span>days</span>
                  </div>
                ))}
              </div>

              <p>
                Each gap is multiplied by the confidence you gave it. A <b>1</b>{' '}
                shrinks it to 0.4× — about a day. A <b>5</b> stretches it to 2×.
                This is why the rating is worth being honest about.
              </p>

              <p>
                <b>Revision</b> in the sidebar is everything the schedule says is
                due, plus anything you flagged by hand, each row marked{' '}
                <i>Due today</i>, <i>Due in 5d</i>, or overdue in red.
              </p>

              <div className="docs-box">
                <span className="docs-box-label">Habit</span>
                <p>
                  Work the queue before you start new problems. That is the
                  entire benefit of it.
                </p>
              </div>
            </section>

            <section id="reading">
              <Eyebrow>The material</Eyebrow>
              <h2>Pattern guides &amp; Learn</h2>

              <h3>Pattern guides</h3>

              <p>
                One per pattern, about 2,000 words, opened from the section
                header, with Java and C++ side by side. Read the guide before
                the problems in that section — then re-read it after you have
                been stuck on two of them. It reads completely differently the
                second time, and that is when it teaches you the most.
              </p>

              <h3>Learn</h3>

              <p>
                The roadmap teaches the algorithms. <b>Learn</b> is for
                everything around them — the vocabulary you use every day and
                could not define under pressure. Two tracks:
              </p>

              <div className="docs-duo">
                <div className="docs-box">
                  <span className="docs-box-label">React · 43 topics</span>
                  <p>
                    From what happens between a <code>setState</code> and the
                    pixels, through every hook, to the eight ecosystem topics a
                    React job actually expects.
                  </p>
                </div>
                <div className="docs-box">
                  <span className="docs-box-label">Node.js · 68 topics</span>
                  <p>
                    From closures and <code>map</code> to a hardened, paginated,
                    authenticated API with a cache, a queue and tests behind it.
                  </p>
                </div>
              </div>

              <p>Two things worth knowing about the Node track:</p>

              <ul className="docs-list">
                <li>
                  <b>Every topic ends with an Interview table</b> — the
                  questions that topic actually gets asked, answered in a line
                  each.
                </li>
                <li>
                  <b>The examples are runnable</b>, and sections 7–12 build one
                  real <code>/tasks</code> API across topics rather than showing
                  unrelated fragments. You write the server by hand, rewrite it
                  on Express, give it REST semantics and pagination, put it on
                  Postgres, add login, then attack it.
                </li>
              </ul>

              <p>
                Arrow keys page between topics, and the app remembers what you
                have read.
              </p>
            </section>

            <section id="assistant">
              <Eyebrow>Help and planning</Eyebrow>
              <h2>Assistant &amp; Tasks</h2>

              <h3>The assistant</h3>

              <p>
                <b>AI Chat</b> in the sidebar, or the bubble in the corner of
                any page. Pick a model or let it route each question to a
                suitable one. Threads are kept, so you can come back to a
                conversation.
              </p>

              <p>
                The <b>Ask AI</b> button on a problem&rsquo;s statement opens it
                with that problem already attached — for when the notes did not
                answer the question and you do not want to lose your place.
              </p>

              <h3>Tasks</h3>

              <p>
                The roadmap records what happened. <b>Tasks</b> records what you{' '}
                <i>meant</i> to happen. &ldquo;I&rsquo;ll do these three
                sliding-window questions today&rdquo; is about three problems at
                once, has a deadline, and is true before you have opened any of
                them — so it does not fit on a problem row.
              </p>

              <p>A board with columns you define. Each card can carry:</p>

              <ul className="docs-list">
                <li>
                  <b>Subtasks</b>, with their own checkboxes.
                </li>
                <li>
                  <b>A deadline</b> — which defaults to unlimited, because most
                  things do not have one.
                </li>
                <li>
                  <b>Files</b> — screenshots and PDFs, and you can paste a
                  screenshot straight in.
                </li>
                <li>
                  <b>Problems from the roadmap</b>, which tick themselves off as
                  you solve them.
                </li>
                <li>
                  <b>A stopwatch</b> — one running at a time across the board,
                  so you learn how long things actually take.
                </li>
              </ul>
            </section>

            <section id="stats">
              <Eyebrow>The honest view</Eyebrow>
              <h2>Stats</h2>

              <p>Four things, and one of them is the one to act on:</p>

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
                      <td className="docs-gloss">
                        Where you are, split by difficulty.
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <b>Activity heatmap</b>
                      </td>
                      <td className="docs-gloss">
                        A year of days, with your current and longest streak.
                        Selectable over 3, 6 or 12 months, or a calendar year.
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <b>Weakest patterns</b>
                      </td>
                      <td className="docs-gloss">
                        The panel to actually act on. Check it weekly.
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <b>Company coverage</b>
                      </td>
                      <td className="docs-gloss">
                        What you have solved <i>and</i> how many that company
                        asks — 12 solved means nothing on its own.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p>
                <b>Profile</b> holds your picture, your numbers, and an About
                panel for bio, college, graduation year, target role and links.
                Anything you sent through <b>Feedback</b> sits at the foot of
                that page with its status, so a reply does not go unread behind
                a bubble you stopped noticing.
              </p>
            </section>

            <section id="yours">
              <Eyebrow>Setup</Eyebrow>
              <h2>Making it yours</h2>

              <h3>The table</h3>

              <p>
                Twenty-four columns exist; you choose which you see.{' '}
                <b>Columns</b> in the toolbar opens the editor — show and hide,
                reorder, five width presets, and pinning. You can freeze up to
                three columns to the left edge so they stay put as you scroll
                sideways. The layout is saved per browser, so your laptop and
                your monitor can be set up differently.
              </p>

              <h3>Adding your own problems</h3>

              <p>
                <b>Add</b> in the top bar takes a single URL. Paste a LeetCode
                link and the title, difficulty and tags fill themselves in;
                paste anything else and you fill three short fields.
              </p>

              <p>
                Your problems sit in the same pattern sections as the rest,
                carry a <span className="docs-chip">MINE</span> tag, and{' '}
                <b>only you can see them</b>. Under <b>More details</b> you can
                set topic tags, companies, an editorial link, a video, a
                starting status and notes — so adding something you already
                solved counts straight away.
              </p>

              <p>
                You can edit or delete your own problems. The URL is fixed after
                adding, because it is what your history is joined on — delete
                and re-add if the link was wrong.
              </p>

              <h3>Theme</h3>

              <p>
                Light or dark, and thirteen accent colours, from the top bar.
              </p>
            </section>

            <section id="keys">
              <Eyebrow>Faster</Eyebrow>
              <h2>Keyboard shortcuts</h2>

              <p>On the roadmap:</p>
              <Keys rows={ROADMAP_KEYS} />

              <p>On the task board, with a card focused:</p>
              <Keys rows={BOARD_KEYS} />

              <p>
                Single-key shortcuts are off while you are typing in a field or
                while a dialog is open, so <kbd>s</kbd> will not mark something
                solved behind your back.
              </p>
            </section>

            <section id="wrong">
              <Eyebrow>Troubleshooting</Eyebrow>
              <h2>If something looks wrong</h2>

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
            </section>

            <div className="docs-closer">
              <h2>The short version</h2>
              <p>
                Read the pattern guide. Work top to bottom. Time yourself. Be
                honest about whether you needed the video. Work the revision
                queue before starting anything new. Check your weakest patterns
                once a week.
              </p>
              <p>
                The app does the bookkeeping so you can spend your attention on
                the problems.
              </p>

              {/* The one thing on this page that changes with who is reading
                  it: an invitation for a visitor, a way back for a learner. */}
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

            <p className="docs-colophon">
              {BRAND.name} — {BRAND.tagline}. 429 problems across 22 patterns,
              plus 111 reference topics in React and Node.
            </p>
          </main>
        </div>
      </div>
    </div>
  );
}
