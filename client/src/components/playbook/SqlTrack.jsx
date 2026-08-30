import { PLAN_TOTALS, SQL_WEEKS } from '../../playbook/plan.js';
import { Link } from 'react-router-dom';

/**
 * The SQL track — twelve Fridays, and the only track that finishes early.
 *
 * Unlike the design tabs, nothing here is a checkbox. The SQL Lab already
 * tracks every one of the 117 problems per-problem, and a second set of ticks
 * that could disagree with it would be a worse number, not an extra one — so
 * the counts on this page are the lab's own, passed down from the page, and
 * the blocks are a reading order over them rather than a parallel checklist.
 *
 * `stats` may be null: the SQL module can be hidden, or the request can fail,
 * and neither is a reason to withhold the schedule. The blocks render with
 * their planned counts and no progress, which is the honest degradation.
 */
export function SqlTrack({ doc, week, stats }) {
  const solved = stats ? stats.solved : null;
  const total = stats ? stats.total : PLAN_TOTALS.sql;

  return (
    <div className="pb-design">
      <p className="pb-lead">
        Weeks {SQL_WEEKS.from}–{SQL_WEEKS.to}, ninety minutes every Friday, and then it is done. It
        sits on Friday evening on purpose: that is the worst DSA hour in the week and the first one
        you will skip, and SQL is the one thing on this list you can already do tired. Friday
        morning&rsquo;s flagged problems roll into Saturday instead.
      </p>

      <section className="pb-track now" data-track="sql">
        <header className="pb-track-head">
          <div>
            <span className="pb-eyebrow mono">
              WEEKS {SQL_WEEKS.from} – {SQL_WEEKS.to}
            </span>
            <h2>The whole bank, in category order</h2>
          </div>
          <span className="pb-track-count mono">
            {solved == null ? `${total} problems` : `${solved}/${total}`}
          </span>
        </header>

        <p className="pb-track-lead">
          {doc.COPY.sqlLead} <Link to="/sql">Open the lab</Link>.
        </p>

        {doc.SQL_TRACK.map((block) => {
          const [from, to] = block.weeks.split('–').map((s) => Number(s.trim()));
          const state = week > to ? 'past' : week >= from ? 'now' : 'ahead';
          return (
            <section key={block.id} className={`pb-block ${state}`}>
              <header className="pb-block-head">
                <h3>{block.block}</h3>
                <span className="pb-block-weeks mono">weeks {block.weeks}</span>
                <span className="pb-block-count mono">{block.count}</span>
              </header>

              <ul className="pb-sd-list">
                {block.items.map((item) => (
                  <li key={item.id}>
                    <div className="pb-sd-item static">
                      <span className="pb-sd-body">
                        <span className="pb-sd-title">{item.title}</span>
                        <span className="pb-sd-detail">{item.body}</span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </section>
    </div>
  );
}
