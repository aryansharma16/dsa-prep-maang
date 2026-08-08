import { useCallback, useEffect, useState } from 'react';
import { progressApi } from '../api/index.js';
import { errorMessage } from '../api/http.js';
import { CompanyChips } from '../components/problem/CompanyChips.jsx';
import { IconCheck, IconExternal, IconRotate } from '../components/ui/Icons.jsx';
import { useRoadmap } from '../store/RoadmapContext.jsx';

const dayDiff = (date) =>
  Math.round((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));

function dueLabel(item) {
  if (item.dueReason === 'marked') return 'Marked for revision';
  const days = dayDiff(item.progress.nextReviewAt);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  return `Due in ${days}d`;
}

export function Revision() {
  const { setProgress } = useRoadmap();
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

  // Drop the row immediately, but put it back if the write actually failed —
  // otherwise the queue would quietly show fewer items than you really have.
  const applyAndRemove = async (item, patch) => {
    const index = items.findIndex((i) => i._id === item._id);
    setItems((prev) => prev.filter((i) => i._id !== item._id));

    const ok = await setProgress(item._id, patch);
    if (!ok) {
      setItems((prev) => {
        const next = [...prev];
        next.splice(Math.max(0, index), 0, item);
        return next;
      });
    }
  };

  const clear = (item) => applyAndRemove(item, { needsRevision: false });
  const resolve = (item) => applyAndRemove(item, { status: 'solved', needsRevision: false });

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
          Problems you flagged, plus anything the spaced-repetition schedule says is due. Solving
          something pushes it further out; low confidence brings it back sooner.
        </p>
      </div>

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
                  <th style={{ width: 130 }}>Due</th>
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
                      </td>
                      <td className="col-acts">
                        <span className="acts">
                          <button className="act" title="Mark solved again" onClick={() => resolve(item)}>
                            <IconCheck size={13} />
                          </button>
                          <button
                            className="act"
                            title="Remove from revision queue"
                            onClick={() => clear(item)}
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
