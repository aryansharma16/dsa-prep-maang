import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cpApi, progressApi } from '../api/index.js';
import { errorMessage } from '../api/http.js';
import { CompanyChips } from '../components/problem/CompanyChips.jsx';
import {
  IconCheck,
  IconChevronRight,
  IconExternal,
  IconInfo,
  IconRotate,
} from '../components/ui/Icons.jsx';
import { useLocalState } from '../hooks/useLocalState.js';
import { ratingKey } from '../theme/cfRating.js';
import { useAuth } from '../store/AuthContext.jsx';
import { moduleVisible } from '../store/modules.js';
import { useRoadmap } from '../store/RoadmapContext.jsx';
import { MotivationLine } from '../components/ui/MotivationLine.jsx';

const dayDiff = (date) =>
  Math.round((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));

function dueLabel(item) {
  if (item.dueReason === 'marked') return 'Marked for revision';
  const days = dayDiff(item.progress.nextReviewAt);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  return `Due in ${days}d`;
}

/** `12 Aug` — a date read once, so no year unless it is not this one. */
const shortDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
};

/**
 * How the queue works, said once, at the top.
 *
 * Collapsible and remembered, because this is a page you work rather than read:
 * the explanation earns its space the first week and is in the way by the
 * third. Open by default, so the first visit is not a queue with two unlabelled
 * icons on every row.
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
                Two ways, and a row can arrive by either. You <b>flagged</b> it by hand with the
                circular arrow, or the <b>schedule</b> says it is due — every solve books the next
                review.
              </p>
            </div>

            <div>
              <span className="rev-how-label">The ladder</span>
              <p>
                Reviews widen as they keep going well: <b>3 → 7 → 21 → 60 days</b>, then it stays at
                60. Each gap is multiplied by the confidence you gave the problem — a <b>1</b>{' '}
                shrinks it to 0.4×, a <b>5</b> stretches it to 2×. So a shaky problem comes back
                tomorrow and one you know gets out of your way for months.
              </p>
            </div>

            <div>
              <span className="rev-how-label">The two buttons</span>
              <p>
                <b>Tick</b> — you came back to it and got it. The ladder moves on a rung and the
                next date is set from today.
              </p>
              <p>
                <b>Arrow</b> — take it off the list without claiming a review. It clears the flag,
                and clears the schedule only if that schedule is what put the row here; one still in
                the future is left alone.
              </p>
            </div>
          </div>

          <p className="rev-how-foot">
            Each row shows where it is on the ladder and what a tick would buy it. The full guide is
            in <Link to="/docs#revision">the field guide</Link>.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Where one problem sits on the ladder, and what getting it right buys.
 *
 * The pips are the point: "review 2 of 4" is the fact that turns a queue of
 * identical-looking rows into a queue where you can see which ones you have
 * nearly finished with. `nextGapDays` is computed by the server so this cannot
 * quote a different number than the one the tick will actually write.
 */
function LadderPips({ review, marked }) {
  if (!review) return null;
  const { stage, rungs, lastReviewedAt, nextGapDays } = review;
  const seen = shortDate(lastReviewedAt);

  return (
    <span
      className="rev-ladder"
      title={
        `Review ${Math.min(stage + 1, rungs)} of ${rungs}` +
        (seen ? ` · last seen ${seen}` : '') +
        ` · getting it schedules the next one ${nextGapDays} days out`
      }
    >
      <span className="rev-pips" aria-hidden="true">
        {Array.from({ length: rungs }, (_, i) => (
          <i key={i} className={i < stage ? 'done' : i === stage ? 'now' : ''} />
        ))}
      </span>
      <span className="rev-ladder-say">
        {marked ? 'flagged by you' : `review ${Math.min(stage + 1, rungs)}/${rungs}`}
        <b> +{nextGapDays}d</b>
      </span>
    </span>
  );
}

export function Revision() {
  const { reviewProblem } = useRoadmap();
  const { modules } = useAuth();
  const hasCp = moduleVisible(modules, 'procoder');

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  /*
    Which curriculum's queue is on screen. There are two collections behind
    this page now and they are due independently — a CP problem coming back
    round has nothing to do with an interview problem doing the same — so the
    default shows both and the toggle is for when you want to work one.

    Remembered, because it is a decision about how you study rather than a
    thing you re-pick every morning.
  */
  const [source, setSource] = useLocalState('revision-source', 'all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      /*
        Both queues, merged here rather than server-side. They read different
        collections and populate different models, so a single endpoint would
        have to branch on a query string before it could decide what to join —
        and the client is where the two lists have to end up interleaved anyway.

        `allSettled`, so a CP module that is switched off (or a route that 404s
        because it is hidden) leaves the roadmap queue working rather than
        emptying the page.
      */
      const [dsa, cp] = await Promise.allSettled([
        progressApi.revision(),
        hasCp ? cpApi.revision() : Promise.resolve({ items: [] }),
      ]);

      if (dsa.status === 'rejected' && cp.status === 'rejected') throw dsa.reason;

      const merged = [
        ...(dsa.value?.items || []).map((i) => ({ ...i, source: 'dsa' })),
        ...(cp.value?.items || []).map((i) => ({ ...i, source: 'cp' })),
      ];

      /*
        Overdue first, then by how soon. Marked rows have no schedule at all, so
        they sort to the front — they are there because you put them there,
        which is the strongest claim on your attention on this page.
      */
      merged.sort((a, b) => {
        const at = a.progress.nextReviewAt ? new Date(a.progress.nextReviewAt).getTime() : -Infinity;
        const bt = b.progress.nextReviewAt ? new Date(b.progress.nextReviewAt).getTime() : -Infinity;
        return at - bt;
      });

      setItems(merged);
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load your revision queue'));
    } finally {
      setLoading(false);
    }
  }, [hasCp]);

  useEffect(() => {
    load();
  }, [load]);

  /*
    Drop the row immediately, but put it back if the write actually failed —
    otherwise the queue would quietly show fewer items than you really have.

    Both actions go through the review endpoint rather than a status patch.
    They used to send `{ needsRevision: false }`, which is a no-op on a row that
    is in the queue because its *schedule* came due — so the row disappeared,
    the write succeeded, and it was back on the next load. See the server for
    why "I reviewed this" could not be expressed as a field.
  */
  const act = async (item, result) => {
    const index = items.findIndex((i) => i._id === item._id);
    setItems((prev) => prev.filter((i) => i._id !== item._id));

    /*
      A CP row goes to the CP endpoint. Straight to the api rather than through
      CPContext, because that provider is mounted on the /cp route and this page
      is not inside it — and there is no ladder in memory here to keep in step,
      which is the only thing the context would have bought.
    */
    const ok =
      item.source === 'cp'
        ? await cpApi
            .review(item._id, result)
            .then(() => true)
            .catch(() => false)
        : await reviewProblem(item._id, result);

    if (!ok) {
      setItems((prev) => {
        const next = [...prev];
        next.splice(Math.max(0, index), 0, item);
        return next;
      });
    }
  };

  /** Off the list, and nothing else — a schedule not yet due is left alone. */
  const dismiss = (item) => act(item, 'dismissed');
  /** A review that went well: the ladder moves on a rung. */
  const recall = (item) => act(item, 'recalled');

  const counts = {
    all: items.length,
    dsa: items.filter((i) => i.source !== 'cp').length,
    cp: items.filter((i) => i.source === 'cp').length,
  };
  const shown = source === 'all' ? items : items.filter((i) => (i.source || 'dsa') === source);

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
          Problems you flagged, plus anything the spaced-repetition schedule says is due — worked
          before you start anything new, which is the whole benefit of it.
        </p>
      </div>

      <MotivationLine surface="revision" />

      <HowItWorks />

      {/* Only where there is a second queue to switch to. On a deployment with
          Pro Coder hidden, or an account that has never worked the ladder, a
          segmented control with one populated option is furniture. */}
      {hasCp && counts.cp > 0 && (
        <div className="filterbar">
          <div className="size-group filter-seg">
            {[
              { value: 'all', label: 'Both', n: counts.all },
              { value: 'dsa', label: 'Roadmap', n: counts.dsa },
              { value: 'cp', label: 'Pro Coder', n: counts.cp },
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

      {shown.length === 0 ? (
        <div className="empty">
          <h3>Nothing due{source !== 'all' ? ` in ${source === 'cp' ? 'Pro Coder' : 'the roadmap'}` : ''}</h3>
          <p>Mark a problem for revision, or come back after your next solve schedules one.</p>
        </div>
      ) : (
        <div className="pattern">
          <div className="tablewrap">
            <table className="problems revision">
              <thead>
                <tr>
                  <th className="col-status" />
                  <th>Problem</th>
                  <th className="col-diff">Difficulty</th>
                  <th className="col-cos">Asked at</th>
                  <th style={{ width: 168 }}>Due</th>
                  <th className="col-acts">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((item) => {
                  const overdue =
                    item.dueReason === 'scheduled' && dayDiff(item.progress.nextReviewAt) < 0;
                  return (
                    <tr key={item._id}>
                      <td className="col-status">
                        <span className={`status-btn ${item.progress.status}`}>
                          {item.progress.status === 'solved' && <IconCheck size={11} />}
                        </span>
                      </td>
                      <td>
                        <div className="title-cell">
                          <a
                            className="title-link"
                            href={item.url || item.articleUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {item.title}
                          </a>
                          <span className="ext">
                            <IconExternal size={11} />
                          </span>
                          {/* Which curriculum this came from. Only on CP rows:
                              the roadmap is the default and labelling every row
                              would be noise on the common case. */}
                          {item.source === 'cp' && (
                            <span className="tag-mini" title="From the Pro Coder ladder">
                              CP
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="col-diff">
                        {/*
                          A CP row has a Codeforces rating, not an Easy/Medium/
                          Hard label — rendering `diff Easy` for it would be a
                          class that means nothing and a word that is not true.
                        */}
                        {item.source === 'cp' ? (
                          <span
                            className="cf-rating rev-cf-rating"
                            data-band={ratingKey(item.codeforces?.rating)}
                            title={item.codeforces?.division || item.platform}
                          >
                            {item.codeforces?.rating || item.difficulty || '—'}
                          </span>
                        ) : (
                          <span className={`diff ${item.difficulty}`}>{item.difficulty}</span>
                        )}
                      </td>
                      <td className="col-cos">
                        <CompanyChips companies={item.companies} />
                      </td>
                      <td>
                        <span className={`due ${overdue ? 'overdue' : ''}`}>{dueLabel(item)}</span>
                        <LadderPips review={item.review} marked={item.dueReason === 'marked'} />
                      </td>
                      <td className="col-acts">
                        <span className="acts">
                          <button
                            className="act"
                            title="I got it — schedule the next review further out"
                            onClick={() => recall(item)}
                          >
                            <IconCheck size={13} />
                          </button>
                          <button
                            className="act"
                            title="Take it off the queue without reviewing it"
                            onClick={() => dismiss(item)}
                          >
                            <IconRotate size={13} />
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
