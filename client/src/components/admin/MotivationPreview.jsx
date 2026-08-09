import { useEffect, useState } from 'react';
import { adminApi } from '../../api/index.js';

/**
 * What would actually fire, for you, right now.
 *
 * This is the difference between choosing a condition and guessing at one.
 * It calls the real picker over the real signals, so it cannot drift from what
 * a learner sees — and it shows the signals beside the result, because "why is
 * that the line" is almost always answered by one of the numbers.
 *
 * Collapsed by default. It is a debugging aid for whoever is writing copy, not
 * the point of the page.
 */

const SIGNALS = [
  ['solved', (s) => `${s.solvedTotal} / ${s.curriculumTotal}`],
  ['today', (s) => s.solvedToday],
  ['this week', (s) => s.solvedThisWeek],
  ['hard today', (s) => s.hardSolvedToday],
  ['streak', (s) => `${s.streak} (best ${s.maxStreak})`],
  ['days since', (s) => s.daysSinceLastSolve ?? '—'],
  ['due', (s) => s.dueCount],
  ['unfinished', (s) => s.attemptedNotSolved],
  ['weakest', (s) => (s.weakestPattern ? `${s.weakestPattern.name} ${s.weakestPattern.solved}/${s.weakestPattern.total}` : '—')],
];

export function MotivationPreview({ triggers }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState('');

  useEffect(() => {
    if (!open || data) return;
    adminApi
      .motivationPreview()
      .then(setData)
      .catch(() => setFailed('Could not run the preview'));
  }, [open, data]);

  const labelFor = (key) => triggers.find((t) => t.key === key)?.label || key;

  return (
    <div className="admin-zone" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
      <button type="button" className="link-btn" onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide preview' : 'What would I see right now?'}
      </button>

      {open && !data && !failed && <p className="hint">Working it out...</p>}
      {failed && <p className="hint">{failed}</p>}

      {open && data && (
        <div className="panel" style={{ marginTop: 10 }}>
          <div className="panel-body">
            <div className="preview-signals">
              {SIGNALS.map(([label, read]) => (
                <span key={label}>
                  <span className="k">{label}</span>
                  <span className="v mono">{String(read(data.signals))}</span>
                </span>
              ))}
            </div>

            {Object.entries(data.lines).map(([surface, line]) => (
              <div className="preview-row" key={surface}>
                <span className="preview-surface mono">{surface}</span>
                {line ? (
                  <span>
                    <span className="preview-trigger">{labelFor(line.trigger)}</span>
                    {line.text}
                  </span>
                ) : (
                  <span className="hint">nothing matches — this page shows no line</span>
                )}
              </div>
            ))}

            <div className="preview-row">
              <span className="preview-surface mono">login</span>
              {data.login ? (
                <span>
                  <span className="preview-trigger">signed out</span>
                  {data.login.text}
                </span>
              ) : (
                <span className="hint">nothing matches</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
