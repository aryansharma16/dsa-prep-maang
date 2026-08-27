import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cpApi } from '../../api/index.js';
import { MeterRow } from '../ui/MeterRow.jsx';
import { Tile } from '../ui/Tile.jsx';
import { ratingKey } from '../../theme/cfRating.js';

/**
 * The Pro Coder half of the stats page.
 *
 * Its own component fetching its own endpoint, rather than fields folded into
 * `/api/stats`. The two curriculums are measured by different things — the
 * roadmap by difficulty and company coverage, the ladder by rating band and
 * tier — and merging them would produce one response where half the fields are
 * null depending on which half you asked about.
 *
 * It also fails independently, which is the point of the `null` returns below: a
 * hidden Pro Coder module, or an account that has never opened it, leaves the
 * roadmap's stats rendering exactly as they did before this existed.
 */

/**
 * The rating histogram.
 *
 * Codeforces only, and it says so. CodeChef ratings are a different scale
 * calibrated against a different population — a CodeChef 1600 sits far below a
 * Codeforces 1600 — so pouring both into these buckets would pile CodeChef's
 * whole range into the middle of Codeforces' and misreport both.
 */
function RatingHistogram({ ratings }) {
  if (!ratings?.length) return null;
  const peak = Math.max(...ratings.map((r) => r.total), 1);

  return (
    <div className="cp-histogram">
      {ratings.map((band) => {
        const solvedPct = band.total ? (band.solved / band.total) * 100 : 0;
        return (
          <div className="cp-hist-col" key={band.rating} data-band={ratingKey(band.rating)}>
            <div
              className="cp-hist-bar"
              style={{ height: `${Math.max(4, (band.total / peak) * 100)}%` }}
              title={`${band.rating}–${band.rating + 99}: ${band.solved} of ${band.total} solved`}
            >
              <span className="cp-hist-solved" style={{ height: `${solvedPct}%` }} />
            </div>
            {/* Every other label, or 23 four-digit numbers collide. */}
            <span className="cp-hist-label mono">
              {band.rating % 200 === 0 ? band.rating : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function CPStats() {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    cpApi
      .stats()
      .then((d) => live && setData(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  // Silent on failure. The module may be hidden, in which case the route 404s
  // and there is nothing to report — an error panel for a feature this account
  // cannot see would be noise about something they cannot act on.
  if (failed || !data) return null;
  if (!data.totals.total) return null;

  const { totals, tiers, ratings, platforms, patterns, streak, handle } = data;
  const cf = platforms.find((p) => p.platform === 'codeforces');
  const cc = platforms.find((p) => p.platform === 'codechef');

  return (
    <>
      <div className="page-head cp-stat-head">
        <h2>
          Pro Coder <span className="hint">competitive programming</span>
        </h2>
        <Link className="link-btn" to="/cp">
          Open the ladder
        </Link>
      </div>

      <div className="tiles">
        <Tile
          label="Solved on the ladder"
          value={totals.solved}
          sub={`of ${totals.total}`}
          to="/cp"
        />
        <Tile
          label="Codeforces rating"
          value={handle?.rating ?? '—'}
          sub={handle ? handle.handle : 'no handle linked'}
          {...(handle ? {} : { tone: 'attention' })}
        />
        {/* What the judge says versus what you have logged. The gap is the
            interesting number, and it is the whole reason sync exists. */}
        <Tile
          label="Accepted on judge"
          value={totals.onPlatform}
          sub="matched to ladder problems"
        />
        <Tile label="CP streak" value={streak.current} sub={`longest ${streak.max}`} />
      </div>

      <div className="panel">
        <div className="panel-body">

          <div className="cp-stat-split">
            <div>
              <h3 className="cp-stat-h">By tier</h3>
              {tiers.map((t) => (
                <MeterRow key={t.slug} name={t.label} value={t.solved} total={t.total} />
              ))}
            </div>

            <div>
              <h3 className="cp-stat-h">
                By Codeforces rating <span className="hint">solved vs available</span>
              </h3>
              <RatingHistogram ratings={ratings} />

              <div className="cp-platform-split">
                {cf && (
                  <span>
                    Codeforces <b className="mono">{cf.solved}</b>
                    <span className="dim mono">/{cf.total}</span>
                  </span>
                )}
                {cc && (
                  <span>
                    CodeChef <b className="mono">{cc.solved}</b>
                    <span className="dim mono">/{cc.total}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/*
            Where the ladder is thinnest — started but far from finished first,
            then untouched. The same "what next" ranking the roadmap's stats use,
            over a different curriculum.
          */}
          <h3 className="cp-stat-h">Weakest patterns</h3>
          {[...patterns]
            .filter((p) => p.total > 0 && p.solved < p.total)
            .sort((a, b) => a.solved / a.total - b.solved / b.total || b.total - a.total)
            .slice(0, 6)
            .map((p) => (
              <MeterRow key={p.slug} name={p.name} value={p.solved} total={p.total} />
            ))}
        </div>
      </div>
    </>
  );
}
