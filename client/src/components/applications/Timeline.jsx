import {
  IconCalendar,
  IconCheck,
  IconChat,
  IconClose,
  IconNote,
  IconSend,
  IconStar,
} from '../ui/Icons.jsx';
import { stamp } from './time.js';
import {
  closedReasonLabel,
  outcomeHue,
  outcomeLabel,
  roundTypeLabel,
  sourceLabel,
  stageHue,
  stageLabel,
  touchpointLabel,
} from './vocab.js';

/**
 * What happened, newest first.
 *
 * Every row here came off the server already merged and sorted — see
 * `applicationTimeline`. That is deliberate: the merge is over four sources
 * with suppression rules, and a second implementation in the browser would be a
 * second implementation that eventually disagrees with the first.
 *
 * What matters about this screen is what it is *not*. It is not an audit log.
 * Editing a round's date moves its node, because the node is the round rather
 * than a copy of it — there is no correction row, no "moved from Tuesday"
 * entry, and deleting a round removes its node because nothing ever recorded it
 * twice. A timeline that narrated your data entry would answer "what did I
 * type, and when" instead of "what happened with Razorpay", which is the
 * question somebody opened it for.
 *
 * The rail draws itself downward on open and the nodes rise in sequence. It is
 * one keyframe and an `animation-delay` per row rather than a library —
 * see applications.css, and the reduced-motion block at the foot of it, which
 * turns all of it off without changing a thing about what is readable.
 */

export const TIMELINE_ICONS = {
  applied: IconSend,
  stage: IconCheck,
  round: IconCalendar,
  offer: IconStar,
  touchpoint: IconChat,
  closed: IconClose,
};

/**
 * A node's own words. The server ships keys; the labels live in the vocabulary.
 *
 * Exported because the all-companies feed draws the same events and must word
 * them the same way — a round that reads one way in the drawer and another in
 * the feed is two screens disagreeing about one fact.
 */
export function describeEvent(row) {
  switch (row.kind) {
    case 'applied':
      return {
        title: 'Applied',
        detail: row.detail ? `via ${sourceLabel(row.detail)}` : '',
        hue: 'blue',
      };
    case 'stage':
      return { title: `Reached ${stageLabel(row.title)}`, detail: '', hue: stageHue(row.title) };
    case 'round':
      return {
        title: row.title && row.ref?.type !== row.title ? row.title : roundTypeLabel(row.ref?.type),
        detail: outcomeLabel(row.detail),
        hue: outcomeHue(row.detail),
      };
    case 'offer':
      return { title: 'Offer received', detail: '', hue: 'amber' };
    case 'touchpoint':
      return {
        title: touchpointLabel(row.title),
        detail: row.detail,
        hue: row.ref?.fromThem ? 'sky' : 'slate',
      };
    case 'closed':
      return {
        title: stageLabel(row.title),
        detail: row.detail ? closedReasonLabel(row.detail) : '',
        hue: stageHue(row.title),
      };
    default:
      return { title: row.title || '', detail: row.detail || '', hue: 'slate' };
  }
}

export function Timeline({ rows = [], onOpenRound }) {
  if (!rows.length) {
    return (
      <div className="ap-timeline-empty">
        <p>Nothing has happened yet.</p>
        <p className="ap-muted">
          Add a round, or note that somebody got in touch, and it will show up here.
        </p>
      </div>
    );
  }

  return (
    <ol className="ap-timeline">
      {rows.map((row, index) => {
        const { title, detail, hue } = describeEvent(row);
        const Icon = TIMELINE_ICONS[row.kind] || IconNote;
        const roundId = row.ref?.roundId;

        return (
          <li
            key={row.id}
            className="ap-tl-row"
            data-hue={hue}
            /* Staggered, and capped — past about a dozen the delay stops
               reading as a sequence and starts reading as a page that is slow
               to load. */
            style={{ '--i': Math.min(index, 12) }}
          >
            <span className="ap-tl-node" aria-hidden="true">
              <Icon size={11} />
            </span>

            <div className="ap-tl-body">
              <p className="ap-tl-title">
                {roundId && onOpenRound ? (
                  <button type="button" className="link-btn" onClick={() => onOpenRound(roundId)}>
                    {title}
                  </button>
                ) : (
                  title
                )}
                {detail && <span className="ap-tl-detail">{detail}</span>}
              </p>
              <time className="ap-tl-when" dateTime={new Date(row.at).toISOString()}>
                {stamp(row.at)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
