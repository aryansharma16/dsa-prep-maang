import { Link } from 'react-router-dom';
import { IconChevronRight } from '../ui/Icons.jsx';

/**
 * One track on the Learn hub.
 *
 * A `soon` track is a div rather than a Link, and says so. Listing what is
 * coming is the point — a hub with one card reads as abandoned, and a hub with
 * three reads as a plan — but it must never look clickable, so the pill and the
 * missing chevron both carry that.
 */
export function TrackCard({ track, read = 0, total = 0 }) {
  const { slug, name, blurb, status, Icon } = track;
  const soon = status !== 'live';
  const pct = total ? Math.round((read / total) * 100) : 0;

  const body = (
    <>
      <span className="track-card-icon">
        <Icon size={18} />
      </span>
      <span className="track-card-text">
        <span className="track-card-name">
          {name}
          {soon && <span className="track-card-pill">Soon</span>}
        </span>
        <span className="track-card-blurb">{blurb}</span>
        {!soon && total > 0 && (
          <span className="track-card-meter">
            <span className="minibar">
              <span style={{ width: `${pct}%` }} />
            </span>
            <span className="mono">
              {read}/{total}
            </span>
          </span>
        )}
      </span>
      {!soon && (
        <span className="track-card-go" aria-hidden="true">
          <IconChevronRight size={14} />
        </span>
      )}
    </>
  );

  if (soon) {
    return (
      <div className="track-card soon" aria-disabled="true">
        {body}
      </div>
    );
  }

  return (
    <Link className="track-card" to={`/learn/${slug}`}>
      {body}
    </Link>
  );
}
