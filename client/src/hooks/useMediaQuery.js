import { useEffect, useState } from 'react';

/**
 * The width below which this is a phone rather than a small window.
 *
 * Stated here and mirrored by the `max-width: 760px` blocks in app.css. The two
 * have to agree: the drawer is opened by a button CSS hides above this width,
 * so a JS breakpoint that drifted from the stylesheet's would leave the nav
 * open with no way to close it, or closed with no way to open it.
 */
export const NARROW = '(max-width: 760px)';

/**
 * Subscribes to a media query and re-renders when it flips.
 *
 * For the responsive decisions CSS cannot make on its own — the ones where the
 * *markup* has to differ, not just its styling. The roadmap's frozen columns
 * are the case that forced this into existence: which cells are frozen, and how
 * far each is offset, is computed in JS from the column registry and written
 * into a colgroup. A media query cannot unfreeze them, and hiding a frozen cell
 * from CSS would leave its <col> behind and shear the table out of alignment.
 *
 * Seeded from a lazy initialiser rather than an effect, so the first render is
 * already correct — a phone should never paint the desktop layout and then
 * visibly correct itself.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    // Re-read on subscribe: between the lazy initialiser and this effect the
    // window can already have been resized.
    setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
