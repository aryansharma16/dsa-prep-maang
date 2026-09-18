import { useState } from 'react';

import { IconBuilding } from '../ui/Icons.jsx';

/**
 * A company's logo, or the next best thing.
 *
 * The slug comes from the server, which derived it once and stored it, so this
 * builds a path and nothing else. Same-origin `/api`, so it rides the Vite
 * proxy in dev and the Vercel rewrite in production exactly like every other
 * call — and because the bytes are cached in Mongo behind a month-long
 * `max-age`, a board with four Amazon cards on it costs one request, not four.
 *
 * The fallback ladder is two rungs and both matter. Initials first, because a
 * two-letter mark in the company's own colourless grey is still recognisable at
 * a glance in a column of twenty; the generic building icon only when there is
 * not even a name to take initials from, which happens for the half-second
 * between typing a card into existence and the response landing.
 */

const initials = (name) =>
  String(name || '')
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

export function CompanyMark({ company, slug, size = 22 }) {
  const [failed, setFailed] = useState(false);
  const letters = initials(company);

  if (!slug || failed) {
    return (
      <span className="ap-mark ap-mark-text" style={{ width: size, height: size }} aria-hidden="true">
        {letters || <IconBuilding size={Math.round(size * 0.6)} />}
      </span>
    );
  }

  return (
    <img
      className="ap-mark"
      src={`${import.meta.env.VITE_API_URL || ''}/api/companies/${slug}/logo`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
