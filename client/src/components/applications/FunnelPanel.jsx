import { useEffect, useState } from 'react';

import { applicationsApi } from '../../api/index.js';
import { errorMessage } from '../../api/http.js';
import { IconClose } from '../ui/Icons.jsx';
import { MeterRow } from '../ui/MeterRow.jsx';
import { Tile } from '../ui/Tile.jsx';
import {
  applyMethodLabel,
  familyLabel,
  roundTypeLabel,
  sourceLabel,
  stageLabel,
} from './vocab.js';

/**
 * What the pipeline has actually taught you.
 *
 * Four numbers, and each is here because it answers something you cannot see by
 * looking at the board:
 *
 *   the funnel      how far applications get, read off `reached` and never the
 *                   current stage — an offer you declined ends in `withdrawn`,
 *                   and a funnel built on the stage would report it as though
 *                   it never got past the first screen
 *   by source       which channels convert, with *referred against cold* as a
 *                   cut across all of them rather than as one more channel
 *   where they die  which round type ends the most applications, counting the
 *                   ones that ended in silence as well as the ones anybody
 *                   explicitly failed
 *   time to reply   the median, because one recruiter who answers after a
 *                   hundred and forty days moves a mean and does not move a
 *                   median
 *
 * All four come from one request. The collection is capped at five hundred rows
 * per account, so the server computes them in one pass rather than in three
 * aggregation pipelines — which is the same bargain the roadmap strikes, one
 * fetch and every view derived from it.
 */
export function FunnelPanel({ onClose, title = 'The numbers', hideWhenEmpty = false }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    applicationsApi
      .stats()
      .then((data) => live && setStats(data))
      .catch((err) => live && setError(errorMessage(err, 'Could not load the numbers')));
    return () => {
      live = false;
    };
  }, []);

  /*
    On the Stats page this is a guest, so it keeps the host's manners: no error
    box and no loading block, and nothing at all for an account that has not
    sent anything — the page looks exactly as it did before the module existed.
  */
  if (error) return hideWhenEmpty ? null : <div className="alert">{error}</div>;
  if (!stats) {
    return hideWhenEmpty ? null : (
      <div className="panel ap-stats">
        <div className="loading">Loading…</div>
      </div>
    );
  }

  const applied = stats.totals.applied;
  if (!applied && hideWhenEmpty) return null;
  const rate = (n) => (applied ? `${Math.round((n / applied) * 100)}%` : '—');

  return (
    <section className="panel ap-stats">
      <header className="panel-head">
        {title}
        <span className="spacer" />
        {/* Only where it is a panel you can put away — on the Insights view it
            is the page, and on Stats it is one panel among several. */}
        {onClose && (
          <button type="button" className="icon-btn" title="Hide" onClick={onClose}>
            <IconClose size={13} />
          </button>
        )}
      </header>

      <div className="panel-body ap-stats-body">
        {!applied ? (
          <p className="ap-muted">
            Nothing to count yet. These fill in once a few applications have been somewhere.
          </p>
        ) : (
          <>
            {/* ------------------------------------------------ the funnel */}
            <div className="ap-stat-block">
              <h4>How far they get</h4>
              {stats.funnel.map((step) => (
                <MeterRow
                  key={step.stage}
                  name={stageLabel(step.stage)}
                  value={step.count}
                  total={applied}
                  muted={step.count === 0}
                />
              ))}
            </div>

            {/* ------------------------------------------------- by source */}
            <div className="ap-stat-block">
              <h4>Which channels work</h4>
              <table className="ap-stat-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th />
                    <th>Sent</th>
                    <th>Replied</th>
                    <th>Interviewed</th>
                    <th>Offer</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.bySource.map((row) => (
                    <tr key={`${row.source}-${row.referred}`}>
                      <td>{sourceLabel(row.source)}</td>
                      {/*
                        Referral is its own column rather than its own row in
                        the source list, because it is not a channel — it is
                        something that happened as well as one. See the note in
                        the vocabulary.
                      */}
                      <td>
                        {row.referred ? (
                          <span className="ap-chip ap-chip-ref">referred</span>
                        ) : (
                          <span className="ap-muted">cold</span>
                        )}
                      </td>
                      <td className="mono">{row.applied}</td>
                      <td className="mono">{Math.round((row.screening / row.applied) * 100)}%</td>
                      <td className="mono">{Math.round((row.in_process / row.applied) * 100)}%</td>
                      <td className="mono">{Math.round((row.offer / row.applied) * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* --------------------------------- one click, or a real one */}
            <div className="ap-stat-block">
              <h4>How you applied</h4>
              <table className="ap-stat-table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Sent</th>
                    <th>Replied</th>
                    <th>Offer</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byMethod.map((row) => (
                    <tr key={row.method || 'unsaid'} className={row.oneClick ? 'is-oneclick' : ''}>
                      <td>
                        {row.method ? applyMethodLabel(row.method) : (
                          <span className="ap-muted">Not recorded</span>
                        )}
                      </td>
                      <td className="mono">{row.applied}</td>
                      <td className="mono">{Math.round((row.screening / row.applied) * 100)}%</td>
                      <td className="mono">{Math.round((row.offer / row.applied) * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/*
                The comparison the field exists for, stated in a sentence
                because a table makes you do the subtraction. It only appears
                once both sides have rows — one Easy Apply against one portal
                application is not a finding.
              */}
              {(() => {
                const one = stats.byMethod.filter((row) => row.oneClick);
                const real = stats.byMethod.filter((row) => row.method && !row.oneClick);
                const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
                if (sum(one, 'applied') < 3 || sum(real, 'applied') < 3) return null;
                const pct = (rows) =>
                  Math.round((sum(rows, 'screening') / sum(rows, 'applied')) * 100);
                return (
                  <p className="ap-muted ap-stat-note">
                    One-click applications get a reply {pct(one)}% of the time; the ones you filled
                    in properly, {pct(real)}%.
                  </p>
                );
              })()}
            </div>

            {/* ------------------------------------------ where they die */}
            {stats.kills.length > 0 && (
              <div className="ap-stat-block">
                <h4>Where they end</h4>
                {stats.kills.slice(0, 6).map((kill) => (
                  <MeterRow
                    key={kill.type}
                    name={`${roundTypeLabel(kill.type)} · ${familyLabel(kill.family)}`}
                    value={kill.count}
                    total={stats.kills[0].count}
                  />
                ))}
                <p className="ap-muted ap-stat-note">
                  Counts rounds you failed, and the last round you actually sat on anything that
                  went quiet — which is usually the one nobody told you about.
                </p>
              </div>
            )}

            {/* --------------------------------------------- time to reply */}
            <div className="tiles">
              <Tile
                label="Median time to a reply"
                value={stats.reply.medianDays == null ? '—' : `${stats.reply.medianDays}d`}
                sub={
                  stats.reply.sample
                    ? `across ${stats.reply.sample} that replied`
                    : 'nobody has replied yet'
                }
              />
              <Tile
                label="Reply rate"
                value={rate(stats.funnel.find((step) => step.stage === 'screening')?.count || 0)}
                sub={`of ${applied} sent`}
              />
              <Tile
                label="Referred"
                value={rate(stats.totals.referred)}
                sub={`${stats.totals.referred} applications`}
              />
              <Tile
                label="Rounds sat"
                value={stats.totals.rounds}
                sub={`${stats.totals.live} still live`}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
