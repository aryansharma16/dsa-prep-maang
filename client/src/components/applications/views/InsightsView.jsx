import { FunnelPanel } from '../FunnelPanel.jsx';
import { WeeklyChart } from './WeeklyChart.jsx';

/**
 * What the hunt has taught you, as a page.
 *
 * It used to be a panel you toggled open above the board, and it moved here
 * when the board gained siblings: once there are five ways to look at the same
 * applications, "the numbers" is one of them rather than a drawer bolted onto
 * one of the other four.
 *
 * Two halves, answering two different questions. The chart is *effort* — how
 * much you are actually sending, week to week, which is the number that drifts
 * without anybody deciding it should. The panel below is *yield* — what that
 * effort turns into, by channel, by method, and where it stops. Reading the
 * second without the first is how a slow month gets blamed on LinkedIn.
 *
 * The chart is drawn from the board's cards and honours the page's filters, so
 * "referred only" redraws it. The panel is the server's report over every
 * application and does not — it is the whole-hunt baseline the filtered chart
 * is read against.
 */
export function InsightsView({ apps }) {
  return (
    <div className="ap-insights">
      <section className="panel">
        <header className="panel-head">Applications sent, by week</header>
        <div className="panel-body">
          <WeeklyChart apps={apps} />
        </div>
      </section>

      <FunnelPanel title="What it turned into" />
    </div>
  );
}
