import { Link } from 'react-router-dom';
import { IconArrowRight } from '../ui/Icons.jsx';

/**
 * One track on the Learn hub.
 *
 * A `soon` track is a div rather than a Link, and says so. Listing what is
 * coming is the point — a hub with one card reads as abandoned, and a hub with
 * three reads as a plan — but it must never look clickable, so the pill and the
 * missing arrow both carry that.
 *
 * `data-hue` is the whole of the card's colour. Every tint on it — the icon
 * tile, the meter, the glow that comes up under the pointer — resolves from
 * that one word through the palette in tokens.css, so a track's colour is one
 * line in the registry rather than four rules per track in the stylesheet.
 */
export function TrackCard({ track, read = 0, total = 0 }) {
  const { slug, name, blurb, status, hue, Icon } = track;
  const soon = status !== 'live';
  const pct = total ? Math.round((read / total) * 100) : 0;

  const body = (
    <>
      {/* The glass sheen and the hue glow, as one element rather than two
          pseudo-elements, so the card's own background stays a single flat
          fill the compositor can keep. */}
      <span className="track-card-lume" aria-hidden="true" />
      <span className="track-card-icon">
        <Icon size={19} />
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
          <IconArrowRight size={15} />
        </span>
      )}
    </>
  );

  if (soon) {
    return (
      <div className="track-card soon" data-hue={hue} aria-disabled="true">
        {body}
      </div>
    );
  }

  return (
    <Link className="track-card" data-hue={hue} to={`/learn/${slug}`}>
      {body}
    </Link>
  );
}
