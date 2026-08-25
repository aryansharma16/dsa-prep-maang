import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { progressApi } from '../api/index.js';
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
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await progressApi.revision();
      setItems(data.items);
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load your revision queue'));
    } finally {
      setLoading(false);
    }
  }, []);

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

    const ok = await reviewProblem(item._id, result);
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

      {items.length === 0 ? (
        <div className="empty">
          <h3>Nothing due</h3>
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
                {items.map((item) => {
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
                        </div>
                      </td>
                      <td className="col-diff">
                        <span className={`diff ${item.difficulty}`}>{item.difficulty}</span>
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
