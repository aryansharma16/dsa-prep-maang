import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { cpApi, learnApi, progressApi, sqlApi } from '../api/index.js';
import { errorMessage } from '../api/http.js';
import { CompanyChips } from '../components/problem/CompanyChips.jsx';
import {
  IconCheck,
  IconChevronRight,
  IconExternal,
  IconEye,
  IconEyeOff,
  IconInfo,
  IconRotate,
} from '../components/ui/Icons.jsx';
import { attemptDate } from '../components/problem/attempts.js';
import { REVIEW_ANSWERS, answerBody } from '../components/problem/reviewAnswers.js';
import {
  dateLabel,
  dayWord,
  daysUntil,
  dueHeadline,
  dueTone,
  gapLabel,
  groupByDay,
} from '../components/problem/reviewDates.js';
import { revisionFlagOf } from '../components/problem/revisionFlags.js';
import { SolutionBlock } from '../components/problem/SolutionEditor.jsx';
import { useLocalState } from '../hooks/useLocalState.js';
import { ratingKey } from '../theme/cfRating.js';
import { useAuth } from '../store/AuthContext.jsx';
import { moduleVisible } from '../store/modules.js';
import { useRoadmap } from '../store/RoadmapContext.jsx';
import { MotivationLine } from '../components/ui/MotivationLine.jsx';

/**
 * Where a queue row's title goes when clicked.
 *
 * Returns `{ to }` for somewhere in this app and `{ href }` for somewhere else,
 * and the caller renders a `Link` or an `<a>` accordingly.
 *
 * Three of the four curriculums answer this the same way — a roadmap or ladder
 * problem is a link to a judge, a Learn topic is a page here. The Lab is the one
 * that answers it per row: a problem it hosts opens in the Lab, and a problem it
 * links to opens on the platform. The queue therefore cannot decide by `source`
 * alone, which is what it used to do — and a Lab row's `href` was `undefined`,
 * so its title was an anchor that went nowhere at all.
 */
function queueLink(item) {
  if (item.source === 'learn') return { to: `/learn/${item.track}/${item.topic}` };
  if (item.source === 'sql') return item.url ? { href: item.url } : { to: '/sql' };
  return { href: item.url || item.articleUrl };
}

/** The title, linked wherever that row's title goes. Shared by both lists. */
function QueueTitle({ item }) {
  const link = queueLink(item);
  return (
    <div className="title-cell">
      {link.to ? (
        <Link className="title-link" to={link.to}>
          {item.title}
        </Link>
      ) : (
        <>
          <a className="title-link" href={link.href} target="_blank" rel="noreferrer">
            {item.title}
          </a>
          <span className="ext">
            <IconExternal size={11} />
          </span>
        </>
      )}
      {/* Which curriculum this came from. Never on a roadmap row: that is the
          default, and labelling every one would be noise on the common case. */}
      {item.source === 'cp' && (
        <span className="tag-mini" title="From the Pro Coder ladder">
          CP
        </span>
      )}
      {item.source === 'sql' && <span className="tag-mini">SQL</span>}
      {item.source === 'learn' && (
        <span className="tag-mini" title="A Learn topic you marked read">
          LEARN
        </span>
      )}
    </div>
  );
}

/**
 * How the queue works, said once, at the top.
 *
 * Collapsible and remembered, because this is a page you work rather than read:
 * the explanation earns its space the first week and is in the way by the
 * third. Open by default, so the first visit is not a queue with four unlabelled
 * buttons on every row.
 */
function HowItWorks() {
  const [open, setOpen] = useLocalState('revision-how-open', true);

  return (
    <div className={`rev-how ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="rev-how-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={`chev ${open ? 'open' : ''}`}>
          <IconChevronRight size={11} />
        </span>
        <IconInfo size={13} />
        How this queue works
      </button>

      {open && (
        <div className="rev-how-body">
          <div className="rev-how-grid">
            <div>
              <span className="rev-how-label">How things get here</span>
              <p>
                Two ways. The <b>schedule</b> says it is due — every solve books the next review —
                or you <b>flagged</b> it by hand with the circular arrow, with a reason and a line
                saying what you meant.
              </p>
            </div>

            <div>
              <span className="rev-how-label">Answer with one of four</span>
              <p>
                <b>Missed</b> drops it back a rung and brings it round tomorrow. <b>Hard</b> keeps
                it where it is. <b>Good</b> moves it up one. <b>Easy</b> moves it up and doubles
                the gap. Each button says what it would schedule, and the date it lands on is on
                the row.
              </p>
            </div>

            <div>
              <span className="rev-how-label">The ladder</span>
              <p>
                Four reviews, widening as they keep going well: <b>3 → 7 → 21 → 60 days</b>, then
                every 60. The whole remaining plan is dated on each row, so a problem is never a
                surprise and you can see which ones you have nearly finished with.
              </p>
              <p>
                The <b>circular arrow</b> takes a row off the list without claiming a review — it
                clears the flag and leaves a schedule that is still in the future alone.
              </p>
            </div>
          </div>

          <p className="rev-how-foot">
            Dates past the next one are a forecast: they assume you keep answering <b>Good</b>, and
            they move the moment you do not. The full guide is in{' '}
            <Link to="/docs#revision">the field guide</Link>.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Which review a row is waiting for, 1-based.
 *
 * The server sends this as `review.number` — see `reviewNumber` there, which is
 * the same clamp. The fallback is here so a client running ahead of a server
 * that has not restarted yet renders "review 2 of 4" rather than the literal
 * word `undefined`, which is what a missing field looks like in a table cell.
 */
const reviewNumber = (review) =>
  review?.number ?? Math.max(1, Math.min(review?.stage ?? 1, review?.rungs || 4));

/**
 * Where one problem sits on the ladder, and every date it still owes you.
 *
 * The pips were the whole of this before, and they said "review 2 of 4" and
 * stopped — which is half a sentence. The rest is how many reviews are still
 * owed and the day each one lands on, which is what turns "it will come back"
 * into something you can put next to the week you are actually going to have.
 *
 * Every date is drawn, not the first few. Four is the whole ladder, so the list
 * is short by construction, and truncating the one thing the row exists to say
 * would be an odd economy.
 */
function LadderPlan({ review, marked }) {
  if (!review) return null;
  const { rungs = 4, plan = [] } = review;
  const number = reviewNumber(review);
  // The stage a flagged-but-never-solved row is on is not a review number, and
  // rendering "review 1 of 4" for it would be inventing a history.
  const onLadder = (review.stage ?? 0) >= 1;
  // The last entry repeating means the ladder has topped out — the problem
  // keeps coming back at sixty days rather than being finished with.
  const endless = plan.length > 0 && plan[plan.length - 1].repeats;
  const left = plan.length;

  return (
    <div className="rev-ladder">
      {onLadder && (
        <span
          className="rev-ladder-head"
          title={`Review ${number} of ${rungs}${
            review.lastReviewedAt ? ` · last seen ${dateLabel(review.lastReviewedAt)}` : ''
          }`}
        >
          <span className="rev-pips" aria-hidden="true">
            {Array.from({ length: rungs }, (_, i) => (
              <i key={i} className={i < number - 1 ? 'done' : i === number - 1 ? 'now' : ''} />
            ))}
          </span>
          <span className="rev-ladder-say">
            {marked ? 'flagged' : `review ${number} of ${rungs}`}
            {/* Not on a topped-out row: "1 more after this" would be a lie
                about a problem that now repeats forever, and the plan line
                underneath already says so in the only words that are true. */}
            {left > 0 && !(endless && left === 1) && (
              <>
                {' · '}
                <b>
                  {left} more after this
                </b>
              </>
            )}
          </span>
        </span>
      )}

      {plan.length > 0 && (
        <span
          className="rev-plan"
          title={
            'Every review still owed on this problem. They assume you answer Good ' +
            'each time — any other answer moves the dates after it.'
          }
        >
          <span className="rev-plan-lead">then</span>
          {plan.map((step, i) => (
            <span key={step.at} className="rev-plan-step">
              {i > 0 && <span className="rev-plan-dot">·</span>}
              {dateLabel(step.at, { weekday: false })}
            </span>
          ))}
          {endless && <span className="rev-plan-rep"> and every {plan[plan.length - 1].days}d after</span>}
        </span>
      )}
    </div>
  );
}

/** Why you flagged it, and the line you left — shown wherever the row is. */
function FlagNote({ progress }) {
  const flag = revisionFlagOf(progress?.revisionReason);
  if (!flag && !progress?.revisionNote) return null;

  return (
    <div className="rev-flagnote">
      {flag && (
        <span className="rev-flag-chip" title={flag.hint}>
          {flag.label}
        </span>
      )}
      {progress.revisionNote && <span className="rev-flag-line">{progress.revisionNote}</span>}
    </div>
  );
}

/**
 * The four answers, each labelled with what it would actually schedule.
 *
 * The dates come from the server with the row — see `reviewChoices`. A client
 * that worked them out itself would eventually disagree with the date the
 * server writes, and the number on the button is the one thing here that has to
 * be true.
 */
function ReviewAnswers({ review, onAnswer }) {
  const choices = review?.choices || {};

  return (
    <span className="rev-answers">
      {REVIEW_ANSWERS.map((answer) => {
        const choice = choices[answer.value];
        return (
          <button
            key={answer.value}
            type="button"
            className={`rev-ans ${answer.tone}`}
            onClick={() => onAnswer(answer.value)}
            title={`${answer.hint}${choice ? ` — back on ${dateLabel(choice.at)}` : ''}`}
          >
            <b>{answer.label}</b>
            {choice && <i>{gapLabel(choice.days)}</i>}
          </button>
        );
      })}
    </span>
  );
}

/**
 * One problem, tested rather than reviewed.
 *
 * The card shows a title and nothing else — no difficulty, no companies, no
 * tags, no note, and not the reason you flagged it. Every one of those is a
 * hint, and the whole question being asked is whether the title alone is enough
 * to bring the technique back.
 *
 * The reveal is the payoff and the teaching moment: your own note, the last
 * solution you wrote, why you flagged it, and what you said this problem was the
 * last few times. Reading "I said prefix sums" from two months ago next to what
 * you just typed is the clearest signal in the app that something has or has not
 * stuck.
 */
function TestCard({ item, onAnswer, onSkip }) {
  const [said, setSaid] = useState('');
  const [revealed, setRevealed] = useState(false);

  const progress = item.progress || {};
  // The most recent sitting that actually has code on it — the last attempt may
  // well be one where you never got as far as writing any.
  const lastCode = [...(progress.recentAttempts || [])].reverse().find((a) => a.code);
  const older = progress.recentRecalls || [];

  return (
    <article className="rev-card">
      <header className="rev-card-head">
        <h3>{item.title}</h3>
        {item.source === 'cp' && <span className="tag-mini">CP</span>}
        {item.source === 'learn' && <span className="tag-mini">LEARN</span>}
        {item.source === 'sql' && <span className="tag-mini">SQL</span>}
        <span className="spacer" />
        {/* The one fact that is not a hint: when it was due. Knowing a problem
            is nine days late is not knowing anything about the problem. */}
        <span className={`due ${dueTone(item)}`}>{dueHeadline(item)}</span>
      </header>

      {!revealed ? (
        <>
          <label className="rev-say">
            <span className="rev-label">What is it, and what tells you so?</span>
            <textarea
              rows={2}
              value={said}
              maxLength={500}
              autoComplete="off"
              spellCheck="false"
              placeholder="Sorted array and it wants a pair → two pointers…"
              onChange={(e) => setSaid(e.target.value)}
            />
          </label>
          <div className="rev-card-acts">
            <button type="button" className="btn primary" onClick={() => setRevealed(true)}>
              <IconEye size={13} /> Reveal
            </button>
            <span className="spacer" />
            <button type="button" className="link-btn" onClick={onSkip}>
              Skip
            </button>
          </div>
        </>
      ) : (
        <>
          {said.trim() && (
            <p className="rev-said">
              <span className="rev-label">You said</span>
              {said.trim()}
            </p>
          )}

          <FlagNote progress={progress} />

          {progress.notes ? (
            <p className="rev-note">
              <span className="rev-label">Your note</span>
              {progress.notes}
            </p>
          ) : (
            <p className="rev-note empty-note">
              <span className="rev-label">Your note</span>
              Nothing written down for this one. Worth a line once you have it back.
            </p>
          )}

          {lastCode && (
            <div className="rev-code">
              <span className="rev-label">Last solution you wrote</span>
              <SolutionBlock code={lastCode.code} lang={lastCode.lang} />
            </div>
          )}

          {older.length > 0 && (
            <div className="rev-history">
              <span className="rev-label">What you said before</span>
              <ul>
                {[...older].reverse().map((r) => (
                  <li key={r.at}>
                    <span className="mono">{attemptDate(r.at)}</span> {r.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rev-card-foot">
            {/* Every answer keeps the line, and a wrong recall keeps it most of
                all — "I said prefix sums and it was a monotonic stack" is the
                most useful sentence this feature produces. */}
            <ReviewAnswers review={item.review} onAnswer={(value) => onAnswer(value, said)} />
            <LadderPlan review={item.review} marked={item.dueReason === 'marked'} />
          </div>
        </>
      )}
    </article>
  );
}

/** One block of the queue — the overdue, today's, or the ones you flagged. */
function QueueSection({ title, hint, rows, onAnswer, onDismiss }) {
  if (!rows.length) return null;

  return (
    <section className="pattern rev-section">
      <header className="rev-section-head">
        <h2>
          {title} <span className="mono dim">{rows.length}</span>
        </h2>
        {hint && <p>{hint}</p>}
      </header>

      <div className="tablewrap">
        <table className="problems revision">
          <thead>
            <tr>
              <th className="col-status" />
              <th>Problem</th>
              <th className="col-diff">Difficulty</th>
              <th className="col-cos">Asked at</th>
              <th style={{ width: 210 }}>When</th>
              <th style={{ width: 250 }}>How did it go?</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item._id}>
                <td className="col-status">
                  <span className={`status-btn ${item.progress.status}`}>
                    {item.progress.status === 'solved' && <IconCheck size={11} />}
                  </span>
                </td>
                <td>
                  <QueueTitle item={item} />
                  <FlagNote progress={item.progress} />
                </td>
                <td className="col-diff">
                  {/*
                    A CP row has a Codeforces rating, not an Easy/Medium/Hard
                    label — rendering `diff Easy` for it would be a class that
                    means nothing and a word that is not true.
                  */}
                  {item.source === 'cp' ? (
                    <span
                      className="cf-rating rev-cf-rating"
                      data-band={ratingKey(item.codeforces?.rating)}
                      title={item.codeforces?.division || item.platform}
                    >
                      {item.codeforces?.rating || item.difficulty || '—'}
                    </span>
                  ) : item.source === 'learn' ? (
                    /* Reference prose has no difficulty. An em dash is the
                       honest answer; a made-up "Medium" would not be. */
                    <span className="cell-empty">—</span>
                  ) : (
                    <span className={`diff ${item.difficulty}`}>{item.difficulty}</span>
                  )}
                </td>
                <td className="col-cos">
                  <CompanyChips companies={item.companies} />
                </td>
                <td>
                  <div className="rev-when">
                    <span className={`due ${dueTone(item)}`}>{dueHeadline(item)}</span>
                    {/* The date itself, which the page never used to say. A
                        relative day answers "is this urgent" and nothing else.

                        A flagged row can carry a schedule that has not fired
                        yet, and "You flagged it — Tue 27 Oct" reads as though
                        October is why it is in front of you. It is not, so the
                        date says which it is. */}
                    {item.progress.nextReviewAt && (
                      <span className="rev-when-date mono">
                        {item.dueReason === 'marked' &&
                          (daysUntil(item.progress.nextReviewAt) > 0 ? 'next ' : 'was due ')}
                        {dateLabel(item.progress.nextReviewAt)}
                      </span>
                    )}
                  </div>
                  <LadderPlan review={item.review} marked={item.dueReason === 'marked'} />
                </td>
                <td>
                  <div className="rev-row-acts">
                    <ReviewAnswers review={item.review} onAnswer={(v) => onAnswer(item, v)} />
                    <button
                      className="act"
                      title="Take it off the queue without answering — clears the flag, and leaves a schedule that is still in the future alone"
                      onClick={() => onDismiss(item)}
                    >
                      <IconRotate size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * What is coming, which this page could never say before.
 *
 * A row not yet due was simply absent: the schedule existed as a date on a
 * problem you could not see until the morning it fired, so "when does this come
 * back" and "what is next week like" were unanswerable from the one page whose
 * whole subject is the schedule. Thirty rows arrive with every request — see
 * `UPCOMING_LIMIT` on the server — grouped by the day they land on, because the
 * useful shape of a forecast is days rather than rows.
 */
function ComingUp({ rows }) {
  const [open, setOpen] = useLocalState('revision-upcoming-open', true);
  const days = useMemo(() => groupByDay(rows, (r) => r.progress?.nextReviewAt), [rows]);
  // `days` can be empty while `rows` is not — a row whose date failed to come
  // back is grouped nowhere, and the header below reads `days[0]`.
  if (!days.length) return null;

  return (
    <div className={`rev-how rev-ahead ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="rev-how-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={`chev ${open ? 'open' : ''}`}>
          <IconChevronRight size={11} />
        </span>
        Coming up
        <span className="mono dim">
          {rows.length} scheduled · next {dayWord(daysUntil(days[0].at))}
        </span>
      </button>

      {open && (
        <div className="rev-how-body">
          <ol className="rev-ahead-days">
            {days.map((day) => (
              <li key={day.at}>
                <div className="rev-ahead-when">
                  <b>{dateLabel(day.at)}</b>
                  <span>{dayWord(daysUntil(day.at))}</span>
                </div>
                <ul className="rev-ahead-rows">
                  {day.rows.map((item) => (
                    <li key={item._id}>
                      <QueueTitle item={item} />
                      {/* The same ladder line the due rows carry, so "how many
                          more times does this one come back, and when" is
                          answered in the forecast too and not only once a row
                          has already landed on you. */}
                      <LadderPlan review={item.review} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
          <p className="rev-how-foot">
            Nothing to do here — this is what the schedule has booked. Answering something today
            moves its dates.
          </p>
        </div>
      )}
    </div>
  );
}

export function Revision() {
  const { reviewProblem } = useRoadmap();
  const { modules } = useAuth();
  const hasCp = moduleVisible(modules, 'procoder');
  const hasLearn = moduleVisible(modules, 'learn');
  const hasSql = moduleVisible(modules, 'sql');

  const [items, setItems] = useState([]);
  const [ahead, setAhead] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  /*
    Which curriculum's queue is on screen. There are four collections behind
    this page now and they are due independently — a CP problem coming back
    round has nothing to do with an interview problem doing the same — so the
    default shows everything and the toggle is for when you want to work one.

    Remembered, because it is a decision about how you study rather than a
    thing you re-pick every morning.
  */
  const [source, setSource] = useLocalState('revision-source', 'all');
  /* Remembered like the source above: it is a decision about how you revise
     rather than one you re-make every morning. */
  const [testMode, setTestMode] = useLocalState('revision-test-mode', false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      /*
        Four queues, merged here rather than server-side. They read different
        collections and populate different models, so a single endpoint would
        have to branch on a query string before it could decide what to join —
        and the client is where the lists have to end up interleaved anyway.

        `allSettled`, so a CP module that is switched off (or a route that 404s
        because it is hidden) leaves the roadmap queue working rather than
        emptying the page.
      */
      const [dsa, cp, learn, sql] = await Promise.allSettled([
        progressApi.revision(),
        hasCp ? cpApi.revision() : Promise.resolve({ items: [] }),
        /*
          A third source, merged the same way. Learn topics are due on the same
          ladder as problems — reading something once and never again was the one
          place this app let knowledge leak — and they interleave here rather
          than living on their own page, because "what should I go over this
          morning" is one question.
        */
        hasLearn ? learnApi.revision() : Promise.resolve({ items: [] }),
        /* And a fourth. A SQL problem you solved comes back on the same ladder. */
        hasSql ? sqlApi.revision() : Promise.resolve({ items: [] }),
      ]);

      if (dsa.status === 'rejected' && cp.status === 'rejected') throw dsa.reason;

      const tag = (result, name, key) =>
        (result.value?.[key] || []).map((i) => ({ ...i, source: name }));

      const merged = [
        ...tag(dsa, 'dsa', 'items'),
        ...tag(cp, 'cp', 'items'),
        ...tag(learn, 'learn', 'items'),
        ...tag(sql, 'sql', 'items'),
      ];

      /*
        Overdue first, then by how soon. Flagged rows have no schedule at all, so
        they sort to the front — they are there because you put them there,
        which is the strongest claim on your attention on this page.
      */
      merged.sort((a, b) => {
        const at = a.progress.nextReviewAt ? new Date(a.progress.nextReviewAt).getTime() : -Infinity;
        const bt = b.progress.nextReviewAt ? new Date(b.progress.nextReviewAt).getTime() : -Infinity;
        return at - bt;
      });

      const upcoming = [
        ...tag(dsa, 'dsa', 'upcoming'),
        ...tag(cp, 'cp', 'upcoming'),
        ...tag(learn, 'learn', 'upcoming'),
        ...tag(sql, 'sql', 'upcoming'),
      ].sort((a, b) => new Date(a.progress.nextReviewAt) - new Date(b.progress.nextReviewAt));

      setItems(merged);
      setAhead(upcoming);
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load your revision queue'));
    } finally {
      setLoading(false);
    }
  }, [hasCp, hasLearn, hasSql]);

  useEffect(() => {
    load();
  }, [load]);

  /*
    Drop the row immediately, but put it back if the write actually failed —
    otherwise the queue would quietly show fewer items than you really have.

    Everything goes through the review endpoint rather than a status patch. The
    page used to send `{ needsRevision: false }`, which is a no-op on a row that
    is in the queue because its *schedule* came due — so the row disappeared, the
    write succeeded, and it was back on the next load. See the server for why "I
    reviewed this" could not be expressed as a field.
  */
  const act = async (item, body) => {
    const index = items.findIndex((i) => i._id === item._id);
    setItems((prev) => prev.filter((i) => i._id !== item._id));

    /*
      A CP row goes to the CP endpoint. Straight to the api rather than through
      CPContext, because that provider is mounted on the /cp route and this page
      is not inside it — and there is no ladder in memory here to keep in step,
      which is the only thing the context would have bought.
    */
    const call = () => {
      if (item.source === 'cp') return cpApi.review(item._id, body);
      // A topic is addressed by its two slugs, not by an id — it has no row in
      // any problem collection. See server/src/models/LearnProgress.js.
      if (item.source === 'learn') return learnApi.review(item.track, item.topic, body);
      if (item.source === 'sql') return sqlApi.review(item._id, body);
      return null;
    };

    const ok =
      item.source === 'dsa'
        ? await reviewProblem(item._id, body)
        : await call()
            .then(() => true)
            .catch(() => false);

    if (!ok) {
      setItems((prev) => {
        const next = [...prev];
        next.splice(Math.max(0, index), 0, item);
        return next;
      });
    }
    return ok;
  };

  /**
   * One of the four answers.
   *
   * `missed` is a first-class answer now rather than a dismissal with a flag
   * patched back on from here in a second request — the server drops the row a
   * rung and books it for tomorrow, which is what failing a review should do and
   * never did.
   *
   * On success the row moves into "Coming up" under the date it just bought,
   * rather than simply vanishing off the page. Answering is the one moment the
   * forecast changes, and a row that disappeared at exactly that moment was the
   * page telling you the least when you had just told it the most — you could
   * not see what the answer had bought without reloading.
   *
   * The date and the stage are the server's own, out of `choices`. The plan is
   * only carried over for `good`, and that is not a shortcut: `plan[0]` *is* the
   * date `good` books, so the reviews after it are the rest of the list.
   * `hard`, `easy` and `missed` change the whole curve, and rather than
   * re-deriving it here — the one thing this page deliberately does not do — the
   * row shows its date and waits for the next load for the rest.
   */
  const answer = async (item, value, recallText = '') => {
    const choice = item.review?.choices?.[value];
    const ok = await act(item, answerBody(value, recallText));
    if (!ok || !choice) return;

    const rungs = item.review?.rungs || 4;
    setAhead((prev) =>
      [
        ...prev,
        {
          ...item,
          progress: {
            ...item.progress,
            needsRevision: false,
            revisionReason: '',
            revisionNote: '',
            nextReviewAt: choice.at,
          },
          dueReason: 'scheduled',
          review: {
            ...item.review,
            stage: choice.stage,
            number: Math.max(1, Math.min(choice.stage, rungs)),
            dueAt: choice.at,
            plan: value === 'good' ? (item.review.plan || []).slice(1) : [],
          },
        },
      ].sort((a, b) => new Date(a.progress.nextReviewAt) - new Date(b.progress.nextReviewAt)),
    );
  };

  /** Off the list, and nothing else — a schedule not yet due is left alone. */
  const dismiss = (item) => act(item, { result: 'dismissed' });

  const counts = {
    all: items.length,
    dsa: items.filter((i) => i.source === 'dsa').length,
    cp: items.filter((i) => i.source === 'cp').length,
    learn: items.filter((i) => i.source === 'learn').length,
    sql: items.filter((i) => i.source === 'sql').length,
  };

  const inSource = (row) => source === 'all' || (row.source || 'dsa') === source;
  const shown = items.filter(inSource);
  const shownAhead = ahead.filter(inSource);

  /*
    Three piles rather than one list, because they are three different claims on
    the morning: work that is late, work that is due, and things you asked to see
    again with no date attached. One undifferentiated table sorted by date put
    the second and third next to each other with nothing saying which was which.
  */
  const buckets = {
    overdue: shown.filter((i) => dueTone(i) === 'overdue'),
    today: shown.filter((i) => dueTone(i) === 'today'),
    flagged: shown.filter((i) => dueTone(i) === 'flagged'),
  };

  if (loading) return <div className="loading">Loading revision queue...</div>;
  if (error) {
    return (
      <div className="empty">
        <h3>Could not load</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <h1>Revision Queue</h1>
        <p>
          Everything the schedule says is due, plus what you flagged — worked before you start
          anything new, which is the whole benefit of it. Each row carries its dates: when it is
          due, and when it comes back after that.
        </p>
      </div>

      <MotivationLine surface="revision" />

      <HowItWorks />

      {/* Only where there is a second queue to switch to. On a deployment with
          Pro Coder and Learn hidden, or an account that has never worked either,
          a segmented control with one populated option is furniture. */}
      {counts.all > counts.dsa && (
        <div className="filterbar">
          <div className="size-group filter-seg">
            {[
              { value: 'all', label: 'Everything', n: counts.all },
              { value: 'dsa', label: 'Roadmap', n: counts.dsa },
              ...(hasCp && counts.cp > 0 ? [{ value: 'cp', label: 'Pro Coder', n: counts.cp }] : []),
              ...(hasLearn && counts.learn > 0
                ? [{ value: 'learn', label: 'Learn', n: counts.learn }]
                : []),
              ...(hasSql && counts.sql > 0 ? [{ value: 'sql', label: 'SQL Lab', n: counts.sql }] : []),
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                className={source === option.value ? 'on' : ''}
                aria-pressed={source === option.value}
                onClick={() => setSource(option.value)}
              >
                {option.label}
                <span className="mono dim"> {option.n}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/*
        Test mode.

        The queue's default is a list you look at and answer — which tests
        nothing on its own, because the problem is in front of you while you
        decide whether you remember it. This collapses each row to its title and
        asks for the trigger and the approach before anything is revealed.

        A toggle rather than a replacement: the plain list is still the right
        tool for triaging forty due rows, and this is the right one for actually
        working them.
      */}
      {shown.length > 0 && (
        <div className="filterbar rev-mode">
          <button
            type="button"
            className={`toggle-chip ${testMode ? 'on' : ''}`}
            aria-pressed={testMode}
            onClick={() => setTestMode(!testMode)}
            title="Title only. Say what it is before you see the answer."
          >
            <IconEyeOff size={12} />
            Test mode
          </button>
          {testMode && (
            <span className="hint">
              One at a time, title only. Say the trigger out loud before you type it.
            </span>
          )}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="empty">
          <h3>
            Nothing due
            {source === 'cp' && ' in Pro Coder'}
            {source === 'learn' && ' in Learn'}
            {source === 'sql' && ' in the SQL Lab'}
            {source === 'dsa' && ' in the roadmap'}
          </h3>
          <p>
            {shownAhead.length
              ? 'The schedule is clear today. What it has booked is below.'
              : 'Flag a problem for revision, or come back after your next solve schedules one.'}
          </p>
        </div>
      ) : testMode ? (
        <div className="rev-test">
          {shown.map((item) => (
            <TestCard
              key={item._id}
              item={item}
              onAnswer={(value, text) => answer(item, value, text)}
              onSkip={() => dismiss(item)}
            />
          ))}
        </div>
      ) : (
        <>
          <QueueSection
            title="Late"
            hint="Past their date. These have decayed the most, so they are worth the most."
            rows={buckets.overdue}
            onAnswer={answer}
            onDismiss={dismiss}
          />
          <QueueSection
            title="Due today"
            hint="What the schedule booked for this morning."
            rows={buckets.today}
            onAnswer={answer}
            onDismiss={dismiss}
          />
          <QueueSection
            title="You flagged these"
            hint="No date on them — they are here because you asked. Answering one puts it back on the ladder."
            rows={buckets.flagged}
            onAnswer={answer}
            onDismiss={dismiss}
          />
        </>
      )}

      <ComingUp rows={shownAhead} />
    </>
  );
}
