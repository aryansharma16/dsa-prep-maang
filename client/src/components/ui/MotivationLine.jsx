import { useMotivation } from '../../hooks/useMotivation.js';
import { useRoadmap } from '../../store/RoadmapContext.jsx';

/**
 * One line under the page heading, chosen from what you have actually done.
 *
 * A strip rather than a panel. The line is a remark, not a feature, and giving
 * it a bordered card of its own would make it compete with the data underneath
 * — which is the thing people came to look at.
 *
 * `totals.solved` is the refresh key. It comes from the roadmap context every
 * page already subscribes to, so marking something solved changes it, the
 * cached line misses, and the next one arrives from the server having been
 * chosen with the new numbers. No event bus, no invalidation call at the write
 * site, nothing to forget when a new page is added.
 *
 * Renders nothing at all when there is no line — an unseeded install should
 * look like the app did before this existed, not like something failed.
 */
export function MotivationLine({ surface }) {
  const { totals } = useRoadmap();
  const { line } = useMotivation(surface, totals?.solved ?? '');

  if (!line?.text) return null;

  return (
    <p className="motivation" data-source={line.source}>
      {line.text}
    </p>
  );
}
