import { useEffect, useState } from 'react';

/**
 * The user's picture, or their initials when there is none.
 *
 * The initials hue is derived from the email so it stays the same across
 * sessions and devices, and the text is always near-black — every colour below
 * clears 4.5:1 against it, so the initials stay legible in either theme.
 */
const COLORS = ['#00b8a3', '#ffb800', '#ff375f', '#4c9aff', '#b58cff', '#5ad1b0'];
const INK = '#141414';

export function initialsOf(name = '', fallback = '?') {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return fallback;
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function colorFor(seed = '') {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length];
}

export function Avatar({ name, email, src, size = 28, className = '' }) {
  const initials = initialsOf(name, (email || '?')[0].toUpperCase());
  const radius = size >= 48 ? 10 : 6;

  // A URL that will not load falls back to initials rather than a broken image.
  // Keyed on `src` so replacing the picture clears a previous failure.
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (src && !failed) {
    return (
      <img
        className={`avatar ${className}`}
        src={src}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: radius }}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className={`avatar ${className}`}
      style={{
        width: size,
        height: size,
        background: colorFor(email || name || ''),
        color: INK,
        fontSize: Math.max(10, Math.round(size * 0.4)),
        borderRadius: radius,
      }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
